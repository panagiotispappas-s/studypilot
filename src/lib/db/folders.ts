import { db } from "@/lib/db/indexeddb";
import { createId } from "@/lib/editor/elementUtils";
import { nowIso } from "@/lib/utils/date";
import type { StudyFolder } from "@/types/study";

export async function listFolders(): Promise<StudyFolder[]> {
  return db.folders.orderBy("updatedAt").reverse().toArray();
}

export async function createFolder(input: Pick<StudyFolder, "name"> & Partial<StudyFolder>): Promise<StudyFolder> {
  const timestamp = nowIso();
  const folder: StudyFolder = {
    id: createId("folder"),
    name: input.name.trim(),
    description: input.description,
    color: input.color ?? "#2f6f73",
    icon: input.icon ?? "book",
    ownerId: input.ownerId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await db.folders.add(folder);
  return folder;
}

export async function updateFolder(id: string, patch: Partial<StudyFolder>): Promise<void> {
  await db.folders.update(id, { ...patch, updatedAt: nowIso() });
}

export async function deleteFolderCascade(id: string): Promise<void> {
  const notebooks = await db.notebooks.where("folderId").equals(id).toArray();
  const notebookIds = notebooks.map((notebook) => notebook.id);
  const pages = await db.pages.where("notebookId").anyOf(notebookIds).toArray();
  const pageIds = pages.map((page) => page.id);

  await db.transaction(
    "rw",
    [db.folders, db.notebooks, db.pages, db.pageElements, db.flashcards, db.quizQuestions],
    async () => {
      await db.folders.delete(id);
      await db.notebooks.where("folderId").equals(id).delete();
      if (notebookIds.length > 0) await db.pages.where("notebookId").anyOf(notebookIds).delete();
      if (pageIds.length > 0) await db.pageElements.where("pageId").anyOf(pageIds).delete();
      await db.flashcards.where("folderId").equals(id).delete();
      await db.quizQuestions.where("folderId").equals(id).delete();
    },
  );
}
