import { db } from "@/lib/db/indexeddb";
import { nowIso } from "@/lib/utils/date";
import type { StudyCard } from "@/types/study";

export async function listFlashcards(): Promise<StudyCard[]> {
  return db.flashcards.orderBy("updatedAt").reverse().toArray();
}

export async function saveFlashcards(cards: StudyCard[]): Promise<void> {
  await db.flashcards.bulkPut(cards.map((card) => ({ ...card, updatedAt: nowIso() })));
}

export async function updateFlashcard(id: string, patch: Partial<StudyCard>): Promise<void> {
  await db.flashcards.update(id, { ...patch, updatedAt: nowIso() });
}

export async function deleteFlashcard(id: string): Promise<void> {
  await db.flashcards.delete(id);
}
