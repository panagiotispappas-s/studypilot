import { db } from "@/lib/db/indexeddb";
import { createId } from "@/lib/editor/elementUtils";
import { nowIso } from "@/lib/utils/date";
import type { StudyCard } from "@/types/study";

export async function listFlashcards(): Promise<StudyCard[]> {
  return db.flashcards.orderBy("updatedAt").reverse().toArray();
}

export async function saveFlashcards(cards: StudyCard[]): Promise<void> {
  await db.flashcards.bulkPut(cards.map((card) => ({ ...card, updatedAt: nowIso() })));
}

export async function createFlashcard(card: Pick<StudyCard, "front" | "back"> & Partial<StudyCard>): Promise<StudyCard> {
  const timestamp = nowIso();
  const next: StudyCard = {
    id: createId("card"),
    front: card.front,
    back: card.back,
    folderId: card.folderId,
    notebookId: card.notebookId,
    pageId: card.pageId,
    sourceText: card.sourceText,
    difficulty: card.difficulty ?? "medium",
    createdAt: timestamp,
    updatedAt: timestamp,
    knownCount: card.knownCount ?? 0,
    unknownCount: card.unknownCount ?? 0,
    lastReviewedAt: card.lastReviewedAt,
  };
  await db.flashcards.add(next);
  return next;
}

export async function updateFlashcard(id: string, patch: Partial<StudyCard>): Promise<void> {
  await db.flashcards.update(id, { ...patch, updatedAt: nowIso() });
}

export async function deleteFlashcard(id: string): Promise<void> {
  await db.flashcards.delete(id);
}
