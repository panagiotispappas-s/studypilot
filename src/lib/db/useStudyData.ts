"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db/indexeddb";
import type {
  NotePage,
  Notebook,
  PageElement,
  PageWithElements,
  QuizQuestion,
  SearchResult,
  StudyCard,
  StudyComment,
  StudyGeneration,
  StudyFolder,
  TextData,
  TableData,
  CommentData,
} from "@/types/study";

export interface StudyDataState {
  folders: StudyFolder[];
  notebooks: Notebook[];
  pages: PageWithElements[];
  flashcards: StudyCard[];
  quizQuestions: QuizQuestion[];
  generations: StudyGeneration[];
  loading: boolean;
  refresh: () => Promise<void>;
  search: (query: string) => SearchResult[];
}

export function useStudyData(notebookId?: string): StudyDataState {
  const [folders, setFolders] = useState<StudyFolder[]>([]);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [pages, setPages] = useState<PageWithElements[]>([]);
  const [flashcards, setFlashcards] = useState<StudyCard[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [generations, setGenerations] = useState<StudyGeneration[]>([]);
  const [comments, setComments] = useState<StudyComment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [nextFolders, nextNotebooks, nextPagesRaw, nextElements, nextCards, nextQuiz, nextGenerations, nextComments] = await Promise.all([
      db.folders.orderBy("updatedAt").reverse().toArray(),
      db.notebooks.orderBy("updatedAt").reverse().toArray(),
      notebookId
        ? db.pages.where("notebookId").equals(notebookId).sortBy("pageNumber")
        : db.pages.orderBy("updatedAt").reverse().toArray(),
      db.pageElements.toArray(),
      db.flashcards.orderBy("updatedAt").reverse().toArray(),
      db.quizQuestions.orderBy("createdAt").reverse().toArray(),
      db.generations.orderBy("createdAt").reverse().toArray(),
      db.comments.orderBy("updatedAt").reverse().toArray(),
    ]);

    setFolders(nextFolders);
    setNotebooks(nextNotebooks);
    setPages(
      nextPagesRaw.map((page: NotePage) => ({
        ...page,
        elements: nextElements
          .filter((element) => element.pageId === page.id)
          .sort((left, right) => left.zIndex - right.zIndex),
      })),
    );
    setFlashcards(nextCards);
    setQuizQuestions(nextQuiz);
    setGenerations(nextGenerations);
    setComments(nextComments);
    setLoading(false);
  }, [notebookId]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  const searchablePages = useMemo(() => pages, [pages]);

  const search = useCallback(
    (query: string): SearchResult[] => {
      const needle = query.trim().toLowerCase();
      if (!needle) return [];

      const folderResults = folders
        .filter((folder) => folder.name.toLowerCase().includes(needle))
        .map((folder) => ({
          id: folder.id,
          type: "folder" as const,
          title: folder.name,
          subtitle: "Ordner",
          href: `/library?folder=${folder.id}`,
        }));

      const notebookResults = notebooks
        .filter((notebook) => notebook.title.toLowerCase().includes(needle))
        .map((notebook) => ({
          id: notebook.id,
          type: "notebook" as const,
          title: notebook.title,
          subtitle: "Notizbuch",
          href: `/notebook/${notebook.id}`,
        }));

      const pageResults = searchablePages
        .filter((page) => {
          const elementMatch = page.elements.some((element) => elementText(element).toLowerCase().includes(needle));
          const commentMatch = comments.some((comment) => comment.pageId === page.id && comment.text.toLowerCase().includes(needle));
          return elementMatch || commentMatch;
        })
        .map((page) => ({
          id: page.id,
          type: "page" as const,
          title: page.title || `Seite ${page.pageNumber}`,
          subtitle: "Textinhalt",
          href: `/notebook/${page.notebookId}`,
        }));

      const cardResults = flashcards
        .filter((card) => `${card.front} ${card.back}`.toLowerCase().includes(needle))
        .map((card) => ({
          id: card.id,
          type: "flashcard" as const,
          title: card.front,
          subtitle: "Karteikarte",
          href: "/flashcards",
        }));

      const quizResults = quizQuestions
        .filter((question) => question.question.toLowerCase().includes(needle))
        .map((question) => ({
          id: question.id,
          type: "quiz" as const,
          title: question.question,
          subtitle: "Quizfrage",
          href: "/quiz",
        }));

      return [...folderResults, ...notebookResults, ...pageResults, ...cardResults, ...quizResults].slice(0, 12);
    },
    [comments, flashcards, folders, notebooks, quizQuestions, searchablePages],
  );

  return { folders, notebooks, pages, flashcards, quizQuestions, generations, loading, refresh, search };
}

function elementText(element: PageElement): string {
  if (element.type === "text") return (element.data as TextData).text;
  if (element.type === "table") return (element.data as TableData).cells.flat().join(" ");
  if (element.type === "comment") return (element.data as CommentData).text;
  return "";
}
