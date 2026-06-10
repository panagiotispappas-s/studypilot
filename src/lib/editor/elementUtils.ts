import type {
  CommentData,
  ImageData,
  PageElement,
  PageElementType,
  PdfData,
  ShapeData,
  TableData,
  TapeData,
  TextData,
} from "@/types/study";
import { nowIso } from "@/lib/utils/date";

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createTextElement(pageId: string, x: number, y: number): PageElement {
  return baseElement(pageId, "text", x, y, 220, 96, {
    text: "",
    fontSize: 18,
    color: "#18202f",
  } satisfies TextData);
}

export function createShapeElement(
  pageId: string,
  x: number,
  y: number,
  shapeType: ShapeData["shapeType"],
  color: string,
  width: number,
): PageElement {
  return baseElement(pageId, "shape", x, y, shapeType === "line" || shapeType === "arrow" ? 180 : 140, 96, {
    shapeType,
    strokeColor: color,
    fillColor: shapeType === "rectangle" || shapeType === "circle" ? "transparent" : undefined,
    strokeWidth: width,
  } satisfies ShapeData);
}

export function createTableElement(
  pageId: string,
  x: number,
  y: number,
  rows: number,
  columns: number,
): PageElement {
  return baseElement(pageId, "table", x, y, columns * 120, rows * 42, {
    rows,
    columns,
    cells: Array.from({ length: rows }, () => Array.from({ length: columns }, () => "")),
  } satisfies TableData);
}

export function createCommentElement(pageId: string, x: number, y: number): PageElement {
  return baseElement(pageId, "comment", x, y, 220, 128, {
    text: "",
    resolved: false,
  } satisfies CommentData);
}

export function createTapeElement(pageId: string, x: number, y: number, color = "#f2d66b"): PageElement {
  return baseElement(pageId, "tape", x, y, 260, 72, {
    color,
    revealed: false,
  } satisfies TapeData);
}

export function createImageElement(pageId: string, data: ImageData): PageElement {
  return baseElement(pageId, "image", 92, 120, 360, 240, data);
}

export function createPdfElement(pageId: string, data: PdfData): PageElement {
  return baseElement(pageId, "pdf", 72, 88, 650, 850, data);
}

function baseElement(
  pageId: string,
  type: PageElementType,
  x: number,
  y: number,
  width: number,
  height: number,
  data: PageElement["data"],
): PageElement {
  const timestamp = nowIso();
  return {
    id: createId("element"),
    pageId,
    type,
    x,
    y,
    width,
    height,
    zIndex: timestampNumber(),
    data,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function timestampNumber(): number {
  return Date.now();
}
