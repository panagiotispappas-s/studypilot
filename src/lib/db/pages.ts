import { db } from "@/lib/db/indexeddb";
import { createId } from "@/lib/editor/elementUtils";
import { nowIso } from "@/lib/utils/date";
import type { NotePage, PageElement, PageWithElements } from "@/types/study";

export async function listPages(notebookId: string): Promise<PageWithElements[]> {
  const pages = await db.pages.where("notebookId").equals(notebookId).sortBy("pageNumber");
  const pageIds = pages.map((page) => page.id);
  const elements = pageIds.length > 0 ? await db.pageElements.where("pageId").anyOf(pageIds).toArray() : [];
  return pages.map((page) => ({
    ...page,
    elements: elements
      .filter((element) => element.pageId === page.id)
      .sort((left, right) => left.zIndex - right.zIndex),
  }));
}

export async function createPage(notebookId: string, pageNumber?: number): Promise<NotePage> {
  const timestamp = nowIso();
  const existingCount = await db.pages.where("notebookId").equals(notebookId).count();
  const page: NotePage = {
    id: createId("page"),
    notebookId,
    pageNumber: pageNumber ?? existingCount + 1,
    backgroundType: "grid",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.pages.add(page);
  return page;
}

export async function updatePage(id: string, patch: Partial<NotePage>): Promise<void> {
  await db.pages.update(id, { ...patch, updatedAt: nowIso() });
}

export async function deletePage(id: string): Promise<void> {
  const page = await db.pages.get(id);
  if (!page) return;
  await db.transaction("rw", db.pages, db.pageElements, async () => {
    await db.pages.delete(id);
    await db.pageElements.where("pageId").equals(id).delete();
    const remaining = await db.pages.where("notebookId").equals(page.notebookId).sortBy("pageNumber");
    await Promise.all(
      remaining.map((remainingPage, index) =>
        db.pages.update(remainingPage.id, { pageNumber: index + 1, updatedAt: nowIso() }),
      ),
    );
  });
}

export async function duplicatePage(page: PageWithElements): Promise<NotePage> {
  const timestamp = nowIso();
  const pages = await db.pages.where("notebookId").equals(page.notebookId).sortBy("pageNumber");
  const duplicate: NotePage = {
    ...page,
    id: createId("page"),
    title: page.title ? `${page.title} Kopie` : undefined,
    pageNumber: pages.length + 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const elements: PageElement[] = page.elements.map((element) => ({
    ...element,
    id: createId("element"),
    pageId: duplicate.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  await db.transaction("rw", db.pages, db.pageElements, async () => {
    await db.pages.add(duplicate);
    await db.pageElements.bulkAdd(elements);
  });
  return duplicate;
}

export async function movePage(pageId: string, direction: -1 | 1): Promise<void> {
  const page = await db.pages.get(pageId);
  if (!page) return;
  const pages = await db.pages.where("notebookId").equals(page.notebookId).sortBy("pageNumber");
  const index = pages.findIndex((candidate) => candidate.id === pageId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= pages.length) return;
  const current = pages[index];
  const target = pages[nextIndex];
  await db.transaction("rw", db.pages, async () => {
    await db.pages.update(current.id, { pageNumber: target.pageNumber, updatedAt: nowIso() });
    await db.pages.update(target.id, { pageNumber: current.pageNumber, updatedAt: nowIso() });
  });
}

export async function upsertElement(element: PageElement): Promise<void> {
  await db.pageElements.put({ ...element, updatedAt: nowIso() });
}

export async function deleteElement(id: string): Promise<void> {
  await db.pageElements.delete(id);
}

export async function replacePageElements(pageId: string, elements: PageElement[]): Promise<void> {
  await db.transaction("rw", db.pageElements, async () => {
    await db.pageElements.where("pageId").equals(pageId).delete();
    if (elements.length > 0) await db.pageElements.bulkPut(elements);
  });
}
