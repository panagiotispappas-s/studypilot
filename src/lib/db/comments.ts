import { db } from "@/lib/db/indexeddb";
import { nowIso } from "@/lib/utils/date";
import type { StudyComment } from "@/types/study";

export async function listComments(pageId: string): Promise<StudyComment[]> {
  return db.comments.where("pageId").equals(pageId).sortBy("createdAt");
}

export async function saveComment(comment: StudyComment): Promise<void> {
  await db.comments.put({ ...comment, updatedAt: nowIso() });
}

export async function deleteComment(id: string): Promise<void> {
  await db.comments.delete(id);
}
