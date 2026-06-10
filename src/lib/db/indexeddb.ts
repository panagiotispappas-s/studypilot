import Dexie, { type Table } from "dexie";
import type {
  NotePage,
  Notebook,
  PageElement,
  ImportedPdf,
  QuizQuestion,
  StudyAccount,
  StudyCard,
  StudyComment,
  StudyFolder,
  StudyGeneration,
  StudyAuthSession,
  StudyProfile,
} from "@/types/study";

export class StudyPilotDatabase extends Dexie {
  folders!: Table<StudyFolder, string>;
  notebooks!: Table<Notebook, string>;
  pages!: Table<NotePage, string>;
  pageElements!: Table<PageElement, string>;
  comments!: Table<StudyComment, string>;
  importedPdfs!: Table<ImportedPdf, string>;
  flashcards!: Table<StudyCard, string>;
  quizQuestions!: Table<QuizQuestion, string>;
  generations!: Table<StudyGeneration, string>;
  profiles!: Table<StudyProfile, string>;
  accounts!: Table<StudyAccount, string>;
  authSessions!: Table<StudyAuthSession, string>;

  constructor() {
    super("StudyPilotDB");
    this.version(1).stores({
      folders: "id, ownerId, name, updatedAt",
      notebooks: "id, ownerId, folderId, title, favorite, lastOpenedAt, updatedAt",
      pages: "id, ownerId, notebookId, pageNumber, updatedAt",
      pageElements: "id, ownerId, pageId, type, zIndex, updatedAt",
      flashcards: "id, ownerId, folderId, notebookId, pageId, updatedAt",
      quizQuestions: "id, ownerId, folderId, notebookId, pageId, createdAt",
      generations: "id, ownerId, type, createdAt",
    });
    this.version(2).stores({
      folders: "id, userId, name, updatedAt",
      notebooks: "id, userId, folderId, title, favorite, lastOpenedAt, updatedAt",
      pages: "id, userId, notebookId, pageNumber, updatedAt",
      pageElements: "id, userId, pageId, type, zIndex, updatedAt",
      importedPdfs: "id, userId, pageId, notebookId, name, updatedAt",
      flashcards: "id, userId, folderId, notebookId, pageId, updatedAt",
      quizQuestions: "id, userId, folderId, notebookId, pageId, createdAt",
      generations: "id, userId, type, createdAt",
      profiles: "id, userId, email, updatedAt",
      accounts: "id, email, profileId, updatedAt",
      authSessions: "id, userId, profileId, createdAt",
    });
    this.version(3).stores({
      folders: "id, userId, name, updatedAt",
      notebooks: "id, userId, folderId, title, favorite, lastOpenedAt, updatedAt",
      pages: "id, userId, notebookId, pageNumber, updatedAt",
      pageElements: "id, userId, pageId, type, zIndex, updatedAt",
      comments: "id, userId, pageId, elementId, updatedAt",
      importedPdfs: "id, userId, pageId, notebookId, name, updatedAt",
      flashcards: "id, userId, folderId, notebookId, pageId, updatedAt",
      quizQuestions: "id, userId, folderId, notebookId, pageId, createdAt",
      generations: "id, userId, type, createdAt",
      profiles: "id, userId, email, updatedAt",
      accounts: "id, email, profileId, updatedAt",
      authSessions: "id, userId, profileId, createdAt",
    });
  }
}

export const db = new StudyPilotDatabase();
