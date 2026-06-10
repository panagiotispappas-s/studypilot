import { db } from "@/lib/db/indexeddb";
import { normalizeText } from "@/lib/utils/format";
import type {
  CommentData,
  PageElement,
  SourceScope,
  TableData,
  TextData,
} from "@/types/study";

export interface ExtractedScopeText {
  text: string;
  sourceIds: string[];
  pageIds: string[];
}

export async function extractTextFromScope(scope: SourceScope): Promise<ExtractedScopeText> {
  if (scope.type === "selection") {
    return {
      text: scope.selectedText?.trim() ?? "",
      sourceIds: [],
      pageIds: [],
    };
  }
  const pages = await resolvePages(scope);
  const pageIds = pages.map((page) => page.id);
  const elements = pageIds.length > 0 ? await db.pageElements.where("pageId").anyOf(pageIds).toArray() : [];
  const comments = pageIds.length > 0 ? await db.comments.where("pageId").anyOf(pageIds).toArray() : [];
  const chunks = [...elements.flatMap(elementToText), ...comments.map((comment) => comment.text)].map(normalizeText).filter(Boolean);
  return {
    text: chunks.join("\n"),
    sourceIds: resolveSourceIds(scope, pageIds),
    pageIds,
  };
}

async function resolvePages(scope: SourceScope) {
  if (scope.type === "page" && scope.pageId) {
    const page = await db.pages.get(scope.pageId);
    return page ? [page] : [];
  }

  if (scope.type === "notebook" && scope.notebookId) {
    return db.pages.where("notebookId").equals(scope.notebookId).sortBy("pageNumber");
  }

  if (scope.type === "folder" && scope.folderId) {
    const notebooks = await db.notebooks.where("folderId").equals(scope.folderId).toArray();
    const notebookIds = notebooks.map((notebook) => notebook.id);
    return notebookIds.length > 0 ? db.pages.where("notebookId").anyOf(notebookIds).sortBy("pageNumber") : [];
  }

  if (scope.type === "pageRange" && scope.notebookId) {
    const pages = await db.pages.where("notebookId").equals(scope.notebookId).sortBy("pageNumber");
    const from = scope.fromPage ?? 1;
    const to = scope.toPage ?? from;
    return pages.filter((page) => page.pageNumber >= from && page.pageNumber <= to);
  }

  return [];
}

function elementToText(element: PageElement): string[] {
  if (element.type === "text") {
    return [(element.data as TextData).text];
  }
  if (element.type === "table") {
    return (element.data as TableData).cells.flat();
  }
  if (element.type === "comment") {
    return [(element.data as CommentData).text];
  }
  return [];
}

function resolveSourceIds(scope: SourceScope, pageIds: string[]): string[] {
  if (scope.folderId) return [scope.folderId, ...pageIds];
  if (scope.notebookId) return [scope.notebookId, ...pageIds];
  if (scope.pageId) return [scope.pageId];
  return pageIds;
}
