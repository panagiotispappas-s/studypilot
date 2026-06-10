import { db } from "@/lib/db/indexeddb";
import { createId } from "@/lib/editor/elementUtils";
import { nowIso } from "@/lib/utils/date";
import type { Notebook } from "@/types/study";

export async function listNotebooks(): Promise<Notebook[]> {
  return db.notebooks.orderBy("updatedAt").reverse().toArray();
}

export async function createNotebook(input: Pick<Notebook, "folderId" | "title"> & Partial<Notebook>): Promise<Notebook> {
  const timestamp = nowIso();
  const notebook: Notebook = {
    id: createId("notebook"),
    folderId: input.folderId,
    title: input.title.trim(),
    description: input.description,
    coverColor: input.coverColor ?? "#e8f3f1",
    favorite: input.favorite ?? false,
    ownerId: input.ownerId,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastOpenedAt: timestamp,
  };
  await db.notebooks.add(notebook);
  return notebook;
}

export async function updateNotebook(id: string, patch: Partial<Notebook>): Promise<void> {
  await db.notebooks.update(id, { ...patch, updatedAt: nowIso() });
}

export async function touchNotebook(id: string): Promise<void> {
  const timestamp = nowIso();
  await db.notebooks.update(id, { updatedAt: timestamp, lastOpenedAt: timestamp });
}

export async function deleteNotebookCascade(id: string): Promise<void> {
  const pages = await db.pages.where("notebookId").equals(id).toArray();
  const pageIds = pages.map((page) => page.id);
  await db.transaction("rw", [db.notebooks, db.pages, db.pageElements, db.flashcards, db.quizQuestions], async () => {
    await db.notebooks.delete(id);
    await db.pages.where("notebookId").equals(id).delete();
    if (pageIds.length > 0) await db.pageElements.where("pageId").anyOf(pageIds).delete();
    await db.flashcards.where("notebookId").equals(id).delete();
    await db.quizQuestions.where("notebookId").equals(id).delete();
  });
}
