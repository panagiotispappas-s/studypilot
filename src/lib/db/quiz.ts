import { db } from "@/lib/db/indexeddb";
import type { QuizQuestion } from "@/types/study";

export async function listQuizQuestions(): Promise<QuizQuestion[]> {
  return db.quizQuestions.orderBy("createdAt").reverse().toArray();
}

export async function saveQuizQuestions(questions: QuizQuestion[]): Promise<void> {
  await db.quizQuestions.bulkPut(questions);
}

export async function updateQuizQuestion(id: string, patch: Partial<QuizQuestion>): Promise<void> {
  await db.quizQuestions.update(id, patch);
}

export async function deleteQuizQuestion(id: string): Promise<void> {
  await db.quizQuestions.delete(id);
}
