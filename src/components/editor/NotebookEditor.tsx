"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bot,
  Check,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  Highlighter,
  Image as ImageIcon,
  LayoutTemplate,
  Maximize2,
  MessageSquare,
  MousePointer2,
  PenLine,
  Plus,
  Save,
  Sparkles,
  Square,
  Table2,
  Trash2,
  Type,
  Upload,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { deleteComment, listComments, saveComment } from "@/lib/db/comments";
import { db } from "@/lib/db/indexeddb";
import { touchNotebook, updateNotebook } from "@/lib/db/notebooks";
import { createPage, deleteElement, deletePage, duplicatePage, movePage, updatePage, upsertElement } from "@/lib/db/pages";
import { saveImportedPdf } from "@/lib/db/pdfs";
import { useStudyData } from "@/lib/db/useStudyData";
import { distanceToStroke, getRelativePoint, pointsToPath } from "@/lib/editor/canvasUtils";
import {
  createId,
  createImageElement,
  createPdfElement,
  createShapeElement,
  createTableElement,
  createTapeElement,
  createTextElement,
} from "@/lib/editor/elementUtils";
import { nowIso } from "@/lib/utils/date";
import { clamp, cx, downloadText } from "@/lib/utils/format";
import type {
  CommentData,
  DrawingData,
  ImageData,
  PageElement,
  PageWithElements,
  PdfData,
  Point,
  ShapeData,
  Stroke,
  StudyComment,
  TableData,
  TapeData,
  TextData,
} from "@/types/study";

type EditorTool = "select" | "pen" | "marker" | "eraser" | "text" | "shape" | "table" | "image" | "comment" | "pdf" | "tape";
type InspectorTab = "properties" | "comments" | "learn";
type ResizeHandle = "nw" | "ne" | "sw" | "se";

const pageWidth = 794;
const pageHeight = 1123;
const saveDelay = 420;

interface PaperTemplate {
  id: string;
  name: string;
  category: "Standard" | "Schreibpapier" | "Mathe" | "Planung" | "Lernen" | "Projekt" | "Kreativ";
  background: PageWithElements["backgroundType"];
  preview: "blank" | "dots" | "grid-fine" | "grid-medium" | "grid-large" | "lined-tight" | "lined" | "lined-wide" | "cornell" | "columns-1" | "columns-2" | "columns-3" | "margin" | "planner-day" | "planner-week" | "planner-month" | "schedule" | "study" | "flashcard" | "math" | "music" | "project" | "mindmap" | "slide" | "storyboard" | "formula";
}

const templates: PaperTemplate[] = [
  { id: "blank", name: "Leer", category: "Standard", background: "blank", preview: "blank" },
  { id: "dotted", name: "Gepunktet", category: "Standard", background: "dotted", preview: "dots" },
  { id: "grid-fine", name: "Kariert fein", category: "Standard", background: "grid", preview: "grid-fine" },
  { id: "grid-medium", name: "Kariert mittel", category: "Standard", background: "grid", preview: "grid-medium" },
  { id: "grid-large", name: "Kariert groß", category: "Standard", background: "grid", preview: "grid-large" },
  { id: "lined-tight", name: "Liniert schmal", category: "Standard", background: "lined", preview: "lined-tight" },
  { id: "lined", name: "Liniert normal", category: "Standard", background: "lined", preview: "lined" },
  { id: "lined-wide", name: "Liniert breit", category: "Standard", background: "lined", preview: "lined-wide" },
  { id: "cornell", name: "Cornell", category: "Schreibpapier", background: "blank", preview: "cornell" },
  { id: "one-column", name: "Eine Spalte", category: "Schreibpapier", background: "blank", preview: "columns-1" },
  { id: "two-columns", name: "Zwei Spalten", category: "Schreibpapier", background: "blank", preview: "columns-2" },
  { id: "three-columns", name: "Drei Spalten", category: "Schreibpapier", background: "blank", preview: "columns-3" },
  { id: "writing-margin", name: "Schreibpapier mit Rand", category: "Schreibpapier", background: "lined", preview: "margin" },
  { id: "coordinate", name: "Koordinatensystem", category: "Mathe", background: "grid", preview: "math" },
  { id: "math-grid", name: "Mathe kariert", category: "Mathe", background: "grid", preview: "grid-fine" },
  { id: "formula", name: "Formelblatt", category: "Mathe", background: "blank", preview: "formula" },
  { id: "calculation", name: "Rechenpapier", category: "Mathe", background: "grid", preview: "grid-medium" },
  { id: "day-planner", name: "Tagesplaner", category: "Planung", background: "blank", preview: "planner-day" },
  { id: "week-planner", name: "Wochenplaner", category: "Planung", background: "blank", preview: "planner-week" },
  { id: "month-planner", name: "Monatsplaner", category: "Planung", background: "blank", preview: "planner-month" },
  { id: "study-checklist", name: "Lern-Checkliste", category: "Planung", background: "blank", preview: "study" },
  { id: "schedule", name: "Stundenplan", category: "Planung", background: "blank", preview: "schedule" },
  { id: "study-sheet", name: "Lernzettel", category: "Lernen", background: "blank", preview: "study" },
  { id: "summary", name: "Zusammenfassung", category: "Lernen", background: "blank", preview: "columns-2" },
  { id: "flashcard-page", name: "Karteikarten-Seite", category: "Lernen", background: "blank", preview: "flashcard" },
  { id: "vocab", name: "Vokabelblatt", category: "Lernen", background: "blank", preview: "columns-2" },
  { id: "exam-prep", name: "Prüfungsvorbereitung", category: "Lernen", background: "blank", preview: "study" },
  { id: "project-plan", name: "Projektplan", category: "Projekt", background: "blank", preview: "project" },
  { id: "meeting-note", name: "Meetingnotiz", category: "Projekt", background: "blank", preview: "cornell" },
  { id: "mindmap", name: "Mindmap", category: "Projekt", background: "blank", preview: "mindmap" },
  { id: "board", name: "Planungsboard", category: "Projekt", background: "blank", preview: "columns-3" },
  { id: "slide", name: "Blanko Präsentationsfolie", category: "Kreativ", background: "blank", preview: "slide" },
  { id: "storyboard", name: "Storyboard", category: "Kreativ", background: "blank", preview: "storyboard" },
  { id: "sketch", name: "Skizzenpapier", category: "Kreativ", background: "dotted", preview: "dots" },
  { id: "music", name: "Musiknotenpapier", category: "Kreativ", background: "blank", preview: "music" },
];

export function NotebookEditor({ notebookId }: { notebookId: string }) {
  const { notebooks, pages, loading, refresh } = useStudyData(notebookId);
  const notebook = notebooks.find((item) => item.id === notebookId);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [tool, setTool] = useState<EditorTool>("select");
  const [shapeType, setShapeType] = useState<ShapeData["shapeType"]>("rectangle");
  const [strokeColor, setStrokeColor] = useState("#1f2937");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [tableRows, setTableRows] = useState(3);
  const [tableColumns, setTableColumns] = useState(3);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [pageElements, setPageElements] = useState<PageElement[]>([]);
  const [comments, setComments] = useState<StudyComment[]>([]);
  const [savedAt, setSavedAt] = useState("Gespeichert");
  const [zoom, setZoom] = useState(1);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("properties");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [focusElementId, setFocusElementId] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0],
    [activePageId, pages],
  );

  const selectedElement = pageElements.find((element) => element.id === selectedElementId) ?? null;
  const markSaved = useCallback(() => setSavedAt("Gespeichert"), []);

  useEffect(() => {
    if (!activePageId && pages[0]) queueMicrotask(() => setActivePageId(pages[0].id));
  }, [activePageId, pages]);

  useEffect(() => {
    void touchNotebook(notebookId);
  }, [notebookId]);

  useEffect(() => {
    if (!activePage) return;
    queueMicrotask(() => {
      setPageElements(
        activePage.elements
          .filter((element) => element.type !== "comment")
          .sort((left, right) => left.zIndex - right.zIndex),
      );
      setSelectedElementId(null);
      void (async () => {
        const legacyComments = activePage.elements.filter((element) => element.type === "comment");
        if (legacyComments.length > 0) {
          await Promise.all(
            legacyComments.map(async (element) => {
              const data = element.data as CommentData;
              await saveComment({
                id: createId("comment"),
                pageId: activePage.id,
                elementId: undefined,
                text: data.text,
                resolved: data.resolved,
                x: element.x,
                y: element.y,
                createdAt: element.createdAt,
                updatedAt: nowIso(),
              });
              await deleteElement(element.id);
            }),
          );
        }
        setComments(await listComments(activePage.id));
      })();
    });
  }, [activePage?.id, activePage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "TEXTAREA" || target?.tagName === "INPUT" || target?.isContentEditable;
      if (editing) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selectedElementId) {
        event.preventDefault();
        const elementId = selectedElementId;
        clearTimeout(saveTimersRef.current[elementId]);
        setPageElements((current) => current.filter((element) => element.id !== elementId));
        setSelectedElementId(null);
        void deleteElement(elementId).then(markSaved);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [markSaved, selectedElementId]);

  function updateElementLocal(id: string, patch: Partial<PageElement>, commit = true) {
    setPageElements((current) =>
      current
        .map((element) => (element.id === id ? { ...element, ...patch, updatedAt: nowIso() } : element))
        .sort((left, right) => left.zIndex - right.zIndex),
    );
    if (commit) {
      const current = pageElements.find((element) => element.id === id);
      if (current) queueElementSave({ ...current, ...patch, updatedAt: nowIso() });
    }
  }

  function replaceElementLocal(nextElement: PageElement, commit = true) {
    setPageElements((current) =>
      current
        .map((element) => (element.id === nextElement.id ? nextElement : element))
        .sort((left, right) => left.zIndex - right.zIndex),
    );
    if (commit) queueElementSave(nextElement);
  }

  function queueElementSave(element: PageElement) {
    setSavedAt("Speichert...");
    clearTimeout(saveTimersRef.current[element.id]);
    saveTimersRef.current[element.id] = setTimeout(() => {
      void upsertElement({ ...element, updatedAt: nowIso() }).then(markSaved);
    }, saveDelay);
  }

  async function saveElementNow(element: PageElement) {
    clearTimeout(saveTimersRef.current[element.id]);
    setSavedAt("Speichert...");
    await upsertElement({ ...element, updatedAt: nowIso() });
    markSaved();
  }

  async function addPage() {
    const page = await createPage(notebookId);
    setActivePageId(page.id);
    await refresh();
  }

  async function removePage(page: PageWithElements) {
    if (!confirm(`${page.title || `Seite ${page.pageNumber}`} löschen?`)) return;
    await deletePage(page.id);
    setActivePageId(null);
    await refresh();
  }

  async function handlePagePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!activePage || !pageRef.current) return;
    const point = getRelativePoint(event, pageRef.current);

    if (tool === "pen" || tool === "marker") {
      const stroke: Stroke = {
        id: createId("stroke"),
        points: [point],
        color: tool === "marker" ? withAlpha(strokeColor, 0.35) : strokeColor,
        width: tool === "marker" ? strokeWidth * 4 : strokeWidth,
        tool,
      };
      setCurrentStroke(stroke);
      pageRef.current.setPointerCapture(event.pointerId);
      return;
    }

    if (tool === "eraser") {
      await eraseAt(point);
      return;
    }

    if (tool === "text") {
      const element = createTextElement(activePage.id, point.x, point.y);
      setPageElements((current) => [...current, element]);
      setSelectedElementId(element.id);
      setFocusElementId(element.id);
      queueElementSave(element);
      setTool("select");
      return;
    }

    if (tool === "shape") {
      addElement(createShapeElement(activePage.id, point.x, point.y, shapeType, strokeColor, strokeWidth));
      setTool("select");
      return;
    }

    if (tool === "table") {
      addElement(createTableElement(activePage.id, point.x, point.y, tableRows, tableColumns));
      setTool("select");
      return;
    }

    if (tool === "tape") {
      addElement(createTapeElement(activePage.id, point.x, point.y));
      setTool("select");
      return;
    }

    if (tool === "comment") {
      await addComment(point);
      setTool("select");
      setInspectorTab("comments");
      return;
    }

    setSelectedElementId(null);
  }

  function handlePagePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!currentStroke || !pageRef.current) return;
    const point = getRelativePoint(event, pageRef.current);
    setCurrentStroke({ ...currentStroke, points: [...currentStroke.points, point] });
  }

  async function handlePagePointerUp() {
    if (!currentStroke || !activePage) return;
    const element = createStrokeElement(activePage.id, currentStroke);
    setPageElements((current) => [...current, element].sort((left, right) => left.zIndex - right.zIndex));
    await saveElementNow(element);
    setCurrentStroke(null);
  }

  function addElement(element: PageElement) {
    setPageElements((current) => [...current, element].sort((left, right) => left.zIndex - right.zIndex));
    setSelectedElementId(element.id);
    queueElementSave(element);
  }

  async function addComment(point?: Point) {
    if (!activePage) return;
    const timestamp = nowIso();
    const comment: StudyComment = {
      id: createId("comment"),
      pageId: activePage.id,
      elementId: selectedElementId ?? undefined,
      text: "",
      resolved: false,
      x: point?.x,
      y: point?.y,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await saveComment(comment);
    setComments(await listComments(activePage.id));
  }

  async function eraseAt(point: Point) {
    const target = pageElements.find((element) => {
      if (element.type !== "drawing" && element.type !== "highlight") return false;
      const localPoint = { x: point.x - element.x, y: point.y - element.y };
      return (element.data as DrawingData).strokes.some((stroke) => distanceToStroke(localPoint, stroke) < Math.max(14, stroke.width * 2));
    });
    if (target) await removeElement(target.id);
  }

  async function removeElement(id: string) {
    clearTimeout(saveTimersRef.current[id]);
    setPageElements((current) => current.filter((element) => element.id !== id));
    setSelectedElementId(null);
    await deleteElement(id);
    markSaved();
  }

  async function duplicateSelected() {
    if (!selectedElement || !activePage) return;
    const timestamp = nowIso();
    const duplicate: PageElement = {
      ...selectedElement,
      id: createId("element"),
      x: selectedElement.x + 28,
      y: selectedElement.y + 28,
      zIndex: Number(new Date()),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setPageElements((current) => [...current, duplicate]);
    setSelectedElementId(duplicate.id);
    await saveElementNow(duplicate);
  }

  async function changeLayer(direction: "front" | "back") {
    if (!selectedElement) return;
    const zIndex = direction === "front" ? Number(new Date()) : Math.max(1, Math.min(...pageElements.map((element) => element.zIndex)) - 1);
    const next = { ...selectedElement, zIndex, updatedAt: nowIso() };
    replaceElementLocal(next);
    await saveElementNow(next);
  }

  async function importFile(file: File, kind: "image" | "pdf") {
    if (!activePage) return;
    const dataUrl = await fileToDataUrl(file);
    if (kind === "image") {
      addElement(createImageElement(activePage.id, {
        name: file.name,
        dataUrl,
        mimeType: file.type,
      } satisfies ImageData));
    } else {
      const pageCount = await estimatePdfPages(file);
      const element = createPdfElement(activePage.id, {
        name: file.name,
        dataUrl,
        pageCount,
      } satisfies PdfData);
      addElement(element);
      await saveImportedPdf({
        id: createId("pdf"),
        pageId: activePage.id,
        notebookId,
        name: file.name,
        dataUrl,
        pageCount,
        size: file.size,
        mimeType: file.type || "application/pdf",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
    setTool("select");
  }

  async function exportNotebook() {
    if (!notebook) return;
    const allPages = await db.pages.where("notebookId").equals(notebook.id).sortBy("pageNumber");
    const pageIds = allPages.map((page) => page.id);
    const elements = pageIds.length > 0 ? await db.pageElements.where("pageId").anyOf(pageIds).toArray() : [];
    const allComments = pageIds.length > 0 ? await db.comments.where("pageId").anyOf(pageIds).toArray() : [];
    const importedPdfs = await db.importedPdfs.where("notebookId").equals(notebook.id).toArray();
    downloadText(`${notebook.title}.json`, JSON.stringify({ notebook, pages: allPages, elements, comments: allComments, importedPdfs }, null, 2), "application/json");
  }

  async function updateActivePage(patch: Partial<PageWithElements>) {
    if (!activePage) return;
    setSavedAt("Speichert...");
    await updatePage(activePage.id, patch);
    await refresh();
    markSaved();
  }

  async function updateComment(comment: StudyComment, text: string) {
    const next = { ...comment, text, updatedAt: nowIso() };
    setComments((current) => current.map((item) => (item.id === comment.id ? next : item)));
    await saveComment(next);
  }

  async function removeComment(id: string) {
    await deleteComment(id);
    setComments((current) => current.filter((comment) => comment.id !== id));
  }

  if (loading) return <div className="p-8 text-sm text-[#667085]">Lade Notizbuch...</div>;

  if (!notebook) {
    return (
      <div className="p-8">
        <EmptyState title="Notizbuch nicht gefunden." action={<Link href="/library" className="text-sm font-medium text-[#2f6f73]">Zur Bibliothek</Link>} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#252a31] text-[#18202f]">
      <header className="sticky top-0 z-30 border-b border-[#d8ded8] bg-[#fbfcfa]/95 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/library" className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-[#edf2ee]" aria-label="Zur Bibliothek">
              <ArrowLeft size={19} />
            </Link>
            <div className="min-w-0">
              <input
                value={notebook.title}
                onChange={async (event) => {
                  await updateNotebook(notebook.id, { title: event.target.value });
                  await refresh();
                }}
                className="w-full min-w-48 bg-transparent text-base font-semibold outline-none"
                aria-label="Notizbuchname"
              />
              <p className="text-xs text-[#667085]">
                {activePage ? `${activePage.title || `Seite ${activePage.pageNumber}`} · ${activePage.pageNumber} / ${pages.length}` : `${pages.length} Seiten`} · {savedAt}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setTemplateOpen(true)}>
              <LayoutTemplate size={16} />
              Papier
            </Button>
            <Button variant="secondary" onClick={exportNotebook}>
              <Save size={16} />
              JSON
            </Button>
            <label className="hidden items-center gap-2 rounded-md border border-[#d9ded7] bg-white px-3 py-2 text-sm font-medium text-[#334155] lg:flex">
              <ZoomIn size={16} />
              <input
                type="range"
                min="0.75"
                max="1.45"
                step="0.05"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="w-24"
                aria-label="Zoom"
              />
              {Math.round(zoom * 100)}%
            </label>
            <Link
              href={activePage ? `/learn?scope=page&pageId=${activePage.id}&notebookId=${notebook.id}` : "/learn"}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#2f6f73] px-4 py-2 text-sm font-medium text-white hover:bg-[#285d61]"
            >
              <Bot size={16} />
              KI
            </Link>
          </div>
        </div>
        <Toolbar
          tool={tool}
          setTool={setTool}
          strokeColor={strokeColor}
          setStrokeColor={setStrokeColor}
          strokeWidth={strokeWidth}
          setStrokeWidth={setStrokeWidth}
          shapeType={shapeType}
          setShapeType={setShapeType}
          tableRows={tableRows}
          setTableRows={setTableRows}
          tableColumns={tableColumns}
          setTableColumns={setTableColumns}
          onImage={() => imageInputRef.current?.click()}
          onPdf={() => pdfInputRef.current?.click()}
        />
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="border-b border-[#363d47] bg-[#20252d] p-3 text-white lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#f8fafc]">Seiten</h2>
            <Button className="h-9 w-9 p-0" onClick={addPage} aria-label="Seite hinzufügen">
              <Plus size={16} />
            </Button>
          </div>
          {pages.length === 0 ? (
            <EmptyState
              title="Noch keine Seiten."
              description="Füge eine Seite hinzu und beginne mit deinen Notizen."
              action={<Button onClick={addPage}>Seite hinzufügen</Button>}
            />
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-3 lg:overflow-visible">
              {pages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => setActivePageId(page.id)}
                  className={cx(
                    "min-w-36 rounded-md border p-2 text-left transition lg:w-full",
                    activePage?.id === page.id ? "border-[#9bd2ca] bg-[#2d3b43]" : "border-[#39424d] bg-[#29313a] hover:bg-[#303944]",
                  )}
                >
                  <div className="mx-auto mb-2 aspect-[794/1123] w-20 overflow-hidden rounded-sm bg-white shadow-sm">
                    <TemplateLayer templateId={page.templateId} backgroundType={page.backgroundType} compact />
                  </div>
                  <span className="block truncate text-xs font-medium text-white">{page.title || `Seite ${page.pageNumber}`}</span>
                  <span className="mt-1 block text-[11px] text-[#aeb8c4]">{page.elements.filter((element) => element.type !== "comment").length} Elemente</span>
                </button>
              ))}
            </div>
          )}
          {activePage ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={async () => { await duplicatePage(activePage); await refresh(); }}>Duplizieren</Button>
              <Button variant="secondary" onClick={async () => { await movePage(activePage.id, -1); await refresh(); }}><ArrowUp size={14} /> Hoch</Button>
              <Button variant="secondary" onClick={async () => { await movePage(activePage.id, 1); await refresh(); }}><ArrowDown size={14} /> Runter</Button>
              <Button variant="danger" onClick={() => removePage(activePage)}>Löschen</Button>
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 overflow-auto bg-[#2b3038] p-4 lg:p-8">
          {activePage ? (
            <div className="mx-auto min-h-[calc(100vh-170px)] w-full max-w-[980px]">
              <div className="origin-top transition-transform" style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
                <div
                  ref={pageRef}
                  className="relative mx-auto aspect-[794/1123] w-full max-w-[794px] touch-none overflow-hidden rounded-sm bg-white shadow-2xl ring-1 ring-black/10"
                  data-page-surface
                  onPointerDown={handlePagePointerDown}
                  onPointerMove={handlePagePointerMove}
                  onPointerUp={handlePagePointerUp}
                >
                  {activePage.backgroundType === "pdf" && activePage.backgroundPdf ? (
                    <iframe
                      src={activePage.backgroundPdf.dataUrl}
                      title={`${activePage.backgroundPdf.name} Hintergrund`}
                      className="pointer-events-none absolute inset-0 h-full w-full opacity-95"
                    />
                  ) : (
                    <TemplateLayer templateId={activePage.templateId} backgroundType={activePage.backgroundType} />
                  )}

                  {pageElements.map((element) => (
                    <ManipulableElement
                      key={element.id}
                      element={element}
                      selected={selectedElementId === element.id}
                      tool={tool}
                      autoFocus={focusElementId === element.id}
                      onFocused={() => setFocusElementId(null)}
                      onSelect={() => setSelectedElementId(element.id)}
                      onPatch={(patch, commit) => updateElementLocal(element.id, patch, commit)}
                      onReplace={(nextElement, commit) => replaceElementLocal(nextElement, commit)}
                      onCommit={saveElementNow}
                      onDelete={() => removeElement(element.id)}
                    />
                  ))}

                  {currentStroke ? (
                    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${pageWidth} ${pageHeight}`}>
                      <StrokePath stroke={currentStroke} />
                    </svg>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </main>

        <aside className="border-t border-[#dfe6df] bg-[#fbfcfa] lg:border-l lg:border-t-0">
          <div className="grid grid-cols-3 border-b border-[#dfe6df]">
            <PanelTab active={inspectorTab === "properties"} onClick={() => setInspectorTab("properties")}>Eigenschaften</PanelTab>
            <PanelTab active={inspectorTab === "comments"} onClick={() => setInspectorTab("comments")}>Kommentare</PanelTab>
            <PanelTab active={inspectorTab === "learn"} onClick={() => setInspectorTab("learn")}>KI</PanelTab>
          </div>
          <div className="p-4">
            {inspectorTab === "properties" ? (
              <PropertiesPanel
                selectedElement={selectedElement}
                activePage={activePage}
                onDelete={() => selectedElement && removeElement(selectedElement.id)}
                onDuplicate={duplicateSelected}
                onLayer={changeLayer}
                onReplace={replaceElementLocal}
                onUpdatePage={updateActivePage}
                onOpenTemplates={() => setTemplateOpen(true)}
              />
            ) : null}
            {inspectorTab === "comments" ? (
              <CommentsPanel
                comments={comments}
                selectedElement={selectedElement}
                onAdd={() => addComment()}
                onChange={updateComment}
                onDelete={removeComment}
              />
            ) : null}
            {inspectorTab === "learn" ? (
              <LearningSidePanel notebookId={notebookId} activePage={activePage} selectedElement={selectedElement} />
            ) : null}
          </div>
        </aside>
      </div>

      {templateOpen && activePage ? (
        <TemplateChooser
          page={activePage}
          onClose={() => setTemplateOpen(false)}
          onApply={async (patch) => {
            await updateActivePage(patch);
            setTemplateOpen(false);
          }}
        />
      ) : null}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file, "image");
          event.currentTarget.value = "";
        }}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importFile(file, "pdf");
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function Toolbar(props: {
  tool: EditorTool;
  setTool: (tool: EditorTool) => void;
  strokeColor: string;
  setStrokeColor: (value: string) => void;
  strokeWidth: number;
  setStrokeWidth: (value: number) => void;
  shapeType: ShapeData["shapeType"];
  setShapeType: (value: ShapeData["shapeType"]) => void;
  tableRows: number;
  setTableRows: (value: number) => void;
  tableColumns: number;
  setTableColumns: (value: number) => void;
  onImage: () => void;
  onPdf: () => void;
}) {
  const tools: Array<{ id: EditorTool; label: string; icon: ElementType; action?: () => void }> = [
    { id: "select", label: "Auswahl", icon: MousePointer2 },
    { id: "pen", label: "Stift", icon: PenLine },
    { id: "marker", label: "Marker", icon: Highlighter },
    { id: "eraser", label: "Radierer", icon: Eraser },
    { id: "text", label: "Text", icon: Type },
    { id: "shape", label: "Form", icon: Square },
    { id: "table", label: "Tabelle", icon: Table2 },
    { id: "tape", label: "Tape", icon: Maximize2 },
    { id: "image", label: "Bild", icon: ImageIcon, action: props.onImage },
    { id: "comment", label: "Kommentar", icon: MessageSquare },
    { id: "pdf", label: "PDF", icon: Upload, action: props.onPdf },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-t border-[#edf1ec] px-3 py-2 lg:px-5">
      {tools.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            variant={props.tool === item.id ? "primary" : "ghost"}
            className="h-10 shrink-0 px-3"
            onClick={() => {
              props.setTool(item.id);
              item.action?.();
            }}
            title={item.label}
          >
            <Icon size={17} />
            <span className="hidden 2xl:inline">{item.label}</span>
          </Button>
        );
      })}
      <span className="mx-2 hidden h-8 w-px bg-[#dfe6df] sm:block" />
      <input
        type="color"
        value={props.strokeColor}
        onChange={(event) => props.setStrokeColor(event.target.value)}
        className="h-10 w-11 shrink-0 rounded-md border border-[#d9ded7] bg-white p-1"
        aria-label="Farbe"
      />
      <input
        type="range"
        min="1"
        max="12"
        value={props.strokeWidth}
        onChange={(event) => props.setStrokeWidth(Number(event.target.value))}
        className="w-24 shrink-0"
        aria-label="Linienstärke"
      />
      {props.tool === "shape" ? (
        <select
          value={props.shapeType}
          onChange={(event) => props.setShapeType(event.target.value as ShapeData["shapeType"])}
          className="h-10 shrink-0 rounded-md border border-[#d9ded7] bg-white px-2 text-sm"
        >
          <option value="rectangle">Rechteck</option>
          <option value="circle">Kreis</option>
          <option value="line">Linie</option>
          <option value="arrow">Pfeil</option>
        </select>
      ) : null}
      {props.tool === "table" ? (
        <div className="flex shrink-0 items-center gap-2 text-sm">
          <input
            type="number"
            min="1"
            max="8"
            value={props.tableRows}
            onChange={(event) => props.setTableRows(clamp(Number(event.target.value), 1, 8))}
            className="h-10 w-16 rounded-md border border-[#d9ded7] px-2"
            aria-label="Zeilen"
          />
          <span>x</span>
          <input
            type="number"
            min="1"
            max="6"
            value={props.tableColumns}
            onChange={(event) => props.setTableColumns(clamp(Number(event.target.value), 1, 6))}
            className="h-10 w-16 rounded-md border border-[#d9ded7] px-2"
            aria-label="Spalten"
          />
        </div>
      ) : null}
    </div>
  );
}

function ManipulableElement({
  element,
  selected,
  tool,
  autoFocus,
  onFocused,
  onSelect,
  onPatch,
  onReplace,
  onCommit,
  onDelete,
}: {
  element: PageElement;
  selected: boolean;
  tool: EditorTool;
  autoFocus: boolean;
  onFocused: () => void;
  onSelect: () => void;
  onPatch: (patch: Partial<PageElement>, commit: boolean) => void;
  onReplace: (element: PageElement, commit?: boolean) => void;
  onCommit: (element: PageElement) => Promise<void>;
  onDelete: () => void;
}) {
  const dragRef = useRef<{
    kind: "move" | "resize";
    handle?: ResizeHandle;
    start: Point;
    origin: PageElement;
    draft: PageElement;
  } | null>(null);

  const style: CSSProperties = {
    left: `${(element.x / pageWidth) * 100}%`,
    top: `${(element.y / pageHeight) * 100}%`,
    width: `${((element.width ?? 160) / pageWidth) * 100}%`,
    height: `${((element.height ?? 100) / pageHeight) * 100}%`,
    zIndex: element.zIndex,
  };

  function beginMove(event: PointerEvent<HTMLDivElement>) {
    if (tool !== "select") return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-editor-input]") || target.closest("[data-resize-handle]") || target.closest("[data-local-action]")) return;
    event.stopPropagation();
    onSelect();
    dragRef.current = { kind: "move", start: { x: event.clientX, y: event.clientY }, origin: element, draft: element };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function beginResize(handle: ResizeHandle, event: PointerEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onSelect();
    dragRef.current = { kind: "resize", handle, start: { x: event.clientX, y: event.clientY }, origin: element, draft: element };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent<HTMLElement>) {
    const state = dragRef.current;
    if (!state) return;
    const page = (event.currentTarget.closest("[data-page-surface]") ?? event.currentTarget.parentElement) as HTMLElement | null;
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const dx = ((event.clientX - state.start.x) / rect.width) * pageWidth;
    const dy = ((event.clientY - state.start.y) / rect.height) * pageHeight;
    let next: PageElement;
    if (state.kind === "move") {
      next = {
        ...state.origin,
        x: clamp(state.origin.x + dx, 0, pageWidth - (state.origin.width ?? 80)),
        y: clamp(state.origin.y + dy, 0, pageHeight - (state.origin.height ?? 80)),
        updatedAt: nowIso(),
      };
    } else {
      const originWidth = state.origin.width ?? 120;
      const originHeight = state.origin.height ?? 80;
      const west = state.handle?.includes("w");
      const north = state.handle?.includes("n");
      const nextWidth = clamp(originWidth + (west ? -dx : dx), 34, pageWidth);
      const nextHeight = clamp(originHeight + (north ? -dy : dy), 28, pageHeight);
      next = {
        ...state.origin,
        x: west ? clamp(state.origin.x + dx, 0, state.origin.x + originWidth - 34) : state.origin.x,
        y: north ? clamp(state.origin.y + dy, 0, state.origin.y + originHeight - 28) : state.origin.y,
        width: nextWidth,
        height: nextHeight,
        updatedAt: nowIso(),
      };
    }
    dragRef.current = { ...state, draft: next };
    onReplace(next, false);
  }

  async function finishDrag() {
    const draft = dragRef.current?.draft;
    dragRef.current = null;
    if (draft) await onCommit(draft);
  }

  return (
    <div
      className={cx("absolute touch-none", selected && "outline outline-2 outline-[#2f6f73]")}
      style={style}
      onPointerDown={beginMove}
      onPointerMove={drag}
      onPointerUp={finishDrag}
    >
      <ElementContent
        element={element}
        selected={selected}
        autoFocus={autoFocus}
        onFocused={onFocused}
        onSelect={onSelect}
        onPatch={(patch, commit = true) => onPatch(patch, commit)}
        onReplace={onReplace}
      />
      {selected ? (
        <>
          <div className="pointer-events-none absolute inset-0 rounded-sm ring-1 ring-[#2f6f73]" />
          <button
            type="button"
            data-local-action
            className="absolute -top-8 left-0 z-20 flex h-7 items-center gap-1 rounded-md bg-[#2f6f73] px-2 text-xs font-medium text-white shadow"
            onPointerDown={(event) => {
              event.stopPropagation();
              beginMove(event as unknown as PointerEvent<HTMLDivElement>);
            }}
            onPointerMove={drag}
            onPointerUp={finishDrag}
          >
            Verschieben
          </button>
          {(["nw", "ne", "sw", "se"] as ResizeHandle[]).map((handle) => (
            <button
              key={handle}
              type="button"
              data-resize-handle
              aria-label={`Größe ändern ${handle}`}
              className={cx(
                "absolute z-30 h-3.5 w-3.5 rounded-full border border-white bg-[#2f6f73] shadow",
                handle === "nw" && "-left-1.5 -top-1.5 cursor-nwse-resize",
                handle === "ne" && "-right-1.5 -top-1.5 cursor-nesw-resize",
                handle === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                handle === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize",
              )}
              onPointerDown={(event) => beginResize(handle, event)}
              onPointerMove={drag}
              onPointerUp={finishDrag}
            />
          ))}
          <button
            type="button"
            data-local-action
            aria-label="Element löschen"
            className="absolute -top-8 right-0 z-20 flex h-7 w-7 items-center justify-center rounded-md bg-[#b54747] text-white shadow"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={14} />
          </button>
        </>
      ) : null}
    </div>
  );
}

function ElementContent({
  element,
  selected,
  autoFocus,
  onFocused,
  onSelect,
  onPatch,
  onReplace,
}: {
  element: PageElement;
  selected: boolean;
  autoFocus: boolean;
  onFocused: () => void;
  onSelect: () => void;
  onPatch: (patch: Partial<PageElement>, commit?: boolean) => void;
  onReplace: (element: PageElement, commit?: boolean) => void;
}) {
  if (element.type === "text") {
    return (
      <TextBox
        element={element}
        selected={selected}
        autoFocus={autoFocus}
        onFocused={onFocused}
        onSelect={onSelect}
        onPatch={onPatch}
      />
    );
  }

  if (element.type === "shape") return <ShapeView data={element.data as ShapeData} />;
  if (element.type === "drawing" || element.type === "highlight") return <DrawingView element={element} />;
  if (element.type === "table") return <TableView element={element} onPatch={onPatch} />;
  if (element.type === "image") {
    const data = element.data as ImageData;
    return <img src={data.dataUrl} alt={data.name} className="h-full w-full object-contain" draggable={false} />;
  }
  if (element.type === "pdf") {
    const data = element.data as PdfData;
    return (
      <div className="h-full w-full overflow-hidden rounded-sm border border-[#d9ded7] bg-white">
        <iframe src={data.dataUrl} title={data.name} className="pointer-events-none h-full w-full" />
      </div>
    );
  }
  if (element.type === "tape") {
    const data = element.data as TapeData;
    return (
      <button
        type="button"
        className="h-full w-full rounded-sm border border-black/10 text-sm font-semibold shadow-sm transition"
        style={{ background: data.revealed ? "rgba(255,255,255,0.08)" : data.color, color: data.revealed ? "#5b6472" : "#172026" }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onReplace({ ...element, data: { ...data, revealed: !data.revealed }, updatedAt: nowIso() });
        }}
      >
        {data.revealed ? <Eye size={18} className="mx-auto" /> : <EyeOff size={18} className="mx-auto" />}
      </button>
    );
  }
  return null;
}

function TextBox({
  element,
  selected,
  autoFocus,
  onFocused,
  onSelect,
  onPatch,
}: {
  element: PageElement;
  selected: boolean;
  autoFocus: boolean;
  onFocused: () => void;
  onSelect: () => void;
  onPatch: (patch: Partial<PageElement>, commit?: boolean) => void;
}) {
  const data = element.data as TextData;
  const [value, setValue] = useState(data.text);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    queueMicrotask(() => setValue(data.text));
  }, [data.text]);

  useEffect(() => {
    if (!autoFocus) return;
    const node = textRef.current;
    if (!node) return;
    node.focus();
    node.setSelectionRange(node.value.length, node.value.length);
    onFocused();
  }, [autoFocus, onFocused]);

  return (
    <textarea
      ref={textRef}
      data-editor-input
      value={value}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onChange={(event) => {
        const text = event.target.value;
        setValue(text);
        onPatch({ data: { ...data, text } }, true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") textRef.current?.blur();
      }}
      placeholder="Schreiben..."
      className={cx(
        "h-full w-full resize-none rounded-sm border bg-transparent p-1.5 leading-6 outline-none",
        selected ? "border-[#a4c8c2]" : "border-transparent",
      )}
      style={{ fontSize: data.fontSize, color: data.color }}
    />
  );
}

function TableView({ element, onPatch }: { element: PageElement; onPatch: (patch: Partial<PageElement>, commit?: boolean) => void }) {
  const data = element.data as TableData;
  return (
    <div className="h-full w-full overflow-hidden border border-[#98a2b3] bg-white/70">
      <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${data.columns}, minmax(0, 1fr))` }}>
        {data.cells.map((row, rowIndex) =>
          row.map((cell, columnIndex) => (
            <textarea
              key={`${rowIndex}-${columnIndex}`}
              data-editor-input
              value={cell}
              onPointerDown={(event) => event.stopPropagation()}
              onChange={(event) => {
                const cells = data.cells.map((sourceRow) => [...sourceRow]);
                cells[rowIndex][columnIndex] = event.target.value;
                onPatch({ data: { ...data, cells } }, true);
              }}
              className="resize-none border-b border-r border-[#d0d5dd] bg-transparent p-1 text-xs outline-none focus:bg-white/80"
            />
          )),
        )}
      </div>
    </div>
  );
}

function DrawingView({ element }: { element: PageElement }) {
  const width = element.width ?? pageWidth;
  const height = element.height ?? pageHeight;
  return (
    <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      {(element.data as DrawingData).strokes.map((stroke) => <StrokePath key={stroke.id} stroke={stroke} />)}
    </svg>
  );
}

function StrokePath({ stroke }: { stroke: Stroke }) {
  return (
    <path
      d={pointsToPath(stroke.points)}
      fill="none"
      stroke={stroke.color}
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={stroke.tool === "marker" ? 0.72 : 1}
    />
  );
}

function ShapeView({ data }: { data: ShapeData }) {
  if (data.shapeType === "rectangle") {
    return <div className="h-full w-full" style={{ border: `${data.strokeWidth}px solid ${data.strokeColor}`, background: data.fillColor }} />;
  }
  if (data.shapeType === "circle") {
    return <div className="h-full w-full rounded-full" style={{ border: `${data.strokeWidth}px solid ${data.strokeColor}`, background: data.fillColor }} />;
  }
  return (
    <svg className="h-full w-full overflow-visible" viewBox="0 0 100 100">
      <line x1="5" y1="50" x2="92" y2="50" stroke={data.strokeColor} strokeWidth={data.strokeWidth} strokeLinecap="round" />
      {data.shapeType === "arrow" ? (
        <path d="M 78 38 L 94 50 L 78 62" fill="none" stroke={data.strokeColor} strokeWidth={data.strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </svg>
  );
}

function PropertiesPanel({
  selectedElement,
  activePage,
  onDelete,
  onDuplicate,
  onLayer,
  onReplace,
  onUpdatePage,
  onOpenTemplates,
}: {
  selectedElement: PageElement | null;
  activePage?: PageWithElements;
  onDelete: () => void;
  onDuplicate: () => Promise<void>;
  onLayer: (direction: "front" | "back") => Promise<void>;
  onReplace: (element: PageElement, commit?: boolean) => void;
  onUpdatePage: (patch: Partial<PageWithElements>) => Promise<void>;
  onOpenTemplates: () => void;
}) {
  return (
    <div className="space-y-5">
      {activePage ? (
        <section>
          <h2 className="text-sm font-semibold">Seite</h2>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-medium text-[#667085]">
              Seitenname
              <input
                value={activePage.title ?? ""}
                placeholder={`Seite ${activePage.pageNumber}`}
                onChange={(event) => void onUpdatePage({ title: event.target.value || undefined })}
                className="mt-1 h-9 w-full rounded-md border border-[#d9ded7] px-2 text-sm text-[#18202f] outline-none focus:border-[#2f6f73]"
              />
            </label>
            <Button variant="secondary" className="w-full" onClick={onOpenTemplates}>
              <LayoutTemplate size={16} />
              Papier auswählen
            </Button>
          </div>
        </section>
      ) : null}
      <section>
        <h2 className="text-sm font-semibold">Element</h2>
        {!selectedElement ? (
          <p className="mt-2 text-sm leading-6 text-[#667085]">Wähle ein Element aus, um es zu verschieben, zu skalieren oder zu bearbeiten.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-[#667085]">Typ: {elementTypeLabel(selectedElement.type)}</p>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Breite"
                value={selectedElement.width ?? 120}
                onChange={(width) => onReplace({ ...selectedElement, width, updatedAt: nowIso() })}
              />
              <NumberField
                label="Höhe"
                value={selectedElement.height ?? 80}
                onChange={(height) => onReplace({ ...selectedElement, height, updatedAt: nowIso() })}
              />
            </div>
            {selectedElement.type === "text" ? <TextControls element={selectedElement} onReplace={onReplace} /> : null}
            {selectedElement.type === "shape" ? <ShapeControls element={selectedElement} onReplace={onReplace} /> : null}
            {selectedElement.type === "tape" ? <TapeControls element={selectedElement} onReplace={onReplace} /> : null}
            {selectedElement.type === "pdf" ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => onUpdatePage({ backgroundType: "pdf", backgroundPdf: selectedElement.data as PdfData, templateId: "pdf-background" })}
              >
                Als PDF-Hintergrund
              </Button>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={onDuplicate}><Copy size={15} /> Duplizieren</Button>
              <Button variant="secondary" onClick={() => onLayer("front")}>Nach vorne</Button>
              <Button variant="secondary" onClick={() => onLayer("back")}>Nach hinten</Button>
              <Button variant="danger" onClick={onDelete}><Trash2 size={15} /> Löschen</Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function CommentsPanel({
  comments,
  selectedElement,
  onAdd,
  onChange,
  onDelete,
}: {
  comments: StudyComment[];
  selectedElement: PageElement | null;
  onAdd: () => Promise<void>;
  onChange: (comment: StudyComment, text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Kommentare</h2>
          <p className="mt-1 text-xs text-[#667085]">Kommentare erscheinen nur hier, nicht auf dem Papier.</p>
        </div>
        <Button className="h-9 w-9 p-0" onClick={onAdd} aria-label="Kommentar hinzufügen">
          <Plus size={16} />
        </Button>
      </div>
      {selectedElement ? <p className="mt-3 rounded-md bg-[#eef8f5] px-3 py-2 text-xs text-[#2f6f73]">Ausgewähltes Element: {elementTypeLabel(selectedElement.type)}</p> : null}
      {comments.length === 0 ? (
        <p className="mt-4 text-sm text-[#667085]">Noch keine Kommentare auf dieser Seite.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {comments.map((comment) => (
            <article key={comment.id} className="rounded-md border border-[#dfe6df] bg-white p-3">
              <textarea
                value={comment.text}
                onChange={(event) => void onChange(comment, event.target.value)}
                placeholder="Kommentar schreiben"
                className="min-h-20 w-full resize-y rounded-md border border-[#d9ded7] bg-white p-2 text-sm outline-none focus:border-[#2f6f73]"
              />
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[#667085]">
                <span>{comment.elementId ? "Elementbezug" : "Seitenkommentar"}</span>
                <button className="font-medium text-[#b54747]" onClick={() => onDelete(comment.id)}>Löschen</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function LearningSidePanel({
  notebookId,
  activePage,
  selectedElement,
}: {
  notebookId: string;
  activePage?: PageWithElements;
  selectedElement: PageElement | null;
}) {
  return (
    <section>
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e8f3f1] text-[#2f6f73]">
        <Sparkles size={18} />
      </div>
      <h2 className="mt-3 text-sm font-semibold">Lernassistent</h2>
      <p className="mt-2 text-sm leading-6 text-[#667085]">
        Erstelle Lernzettel, Karteikarten oder Quizfragen aus der aktuellen Seite oder aus ausgewählten Textinhalten.
      </p>
      <div className="mt-4 space-y-2">
        <Link
          href={activePage ? `/learn?scope=page&pageId=${activePage.id}&notebookId=${notebookId}` : "/learn"}
          className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#2f6f73] px-4 py-2 text-sm font-medium text-white hover:bg-[#285d61]"
        >
          <Bot size={16} />
          Diese Seite analysieren
        </Link>
        {selectedElement?.type === "text" ? (
          <p className="rounded-md bg-[#fff8d8] px-3 py-2 text-xs text-[#7a5b12]">Ausgewählter Text kann in der Lernzentrale über „ausgewählter Text“ genutzt werden.</p>
        ) : null}
      </div>
    </section>
  );
}

function TemplateChooser({
  page,
  onClose,
  onApply,
}: {
  page: PageWithElements;
  onClose: () => void;
  onApply: (patch: Partial<PageWithElements>) => Promise<void>;
}) {
  const [category, setCategory] = useState<PaperTemplate["category"] | "Alle">("Alle");
  const [selectedTemplateId, setSelectedTemplateId] = useState(page.templateId ?? page.backgroundType ?? "blank");
  const [format, setFormat] = useState(page.paperFormat ?? "A4");
  const [orientation, setOrientation] = useState(page.orientation ?? "portrait");
  const customInputRef = useRef<HTMLInputElement | null>(null);
  const visibleTemplates = category === "Alle" ? templates : templates.filter((template) => template.category === category);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];

  async function importCustomTemplate(file: File) {
    const dataUrl = await fileToDataUrl(file);
    await onApply({
      templateId: "custom-template",
      backgroundType: "pdf",
      backgroundPdf: { name: file.name, dataUrl, pageCount: file.type === "application/pdf" ? await estimatePdfPages(file) : 1 },
      paperFormat: format,
      orientation,
    });
  }

  return (
    <Modal title="Papier auswählen" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex gap-2 border-b border-[#edf1ec] pb-3">
          <Button variant="primary">Papier</Button>
          <Button variant="secondary" disabled>Umschlag</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Format
            <select value={format} onChange={(event) => setFormat(event.target.value as NonNullable<PageWithElements["paperFormat"]>)} className="mt-2 h-10 w-full rounded-md border border-[#d9ded7] px-3">
              <option value="A4">A4</option>
              <option value="A5">A5</option>
              <option value="Letter">Letter</option>
              <option value="iPad">iPad</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            Ausrichtung
            <select value={orientation} onChange={(event) => setOrientation(event.target.value as NonNullable<PageWithElements["orientation"]>)} className="mt-2 h-10 w-full rounded-md border border-[#d9ded7] px-3">
              <option value="portrait">Hochformat</option>
              <option value="landscape">Querformat</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["Alle", "Standard", "Schreibpapier", "Mathe", "Planung", "Lernen", "Projekt", "Kreativ"] as Array<PaperTemplate["category"] | "Alle">).map((item) => (
            <Button key={item} variant={category === item ? "primary" : "secondary"} className="shrink-0" onClick={() => setCategory(item)}>
              {item}
            </Button>
          ))}
        </div>
        <div className="grid max-h-[430px] gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">
          {visibleTemplates.map((template) => (
            <button
              key={template.id}
              className={cx(
                "rounded-lg border bg-white p-3 text-left transition hover:border-[#2f6f73]",
                selectedTemplateId === template.id ? "border-[#2f6f73] shadow-sm" : "border-[#dfe6df]",
              )}
              onClick={() => setSelectedTemplateId(template.id)}
            >
              <div className="aspect-[4/5] overflow-hidden rounded-md border border-[#edf1ec] bg-white">
                <TemplatePreview preview={template.preview} />
              </div>
              <span className="mt-2 block text-sm font-medium">{template.name}</span>
            </button>
          ))}
        </div>
        <div className="rounded-md border border-dashed border-[#cfd8d2] p-3">
          <p className="text-sm font-medium">Eigenes Template importieren</p>
          <p className="mt-1 text-xs text-[#667085]">PDF oder Bild als Seitenhintergrund übernehmen.</p>
          <Button className="mt-3" variant="secondary" onClick={() => customInputRef.current?.click()}>
            <Upload size={16} />
            Datei wählen
          </Button>
          <input
            ref={customInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importCustomTemplate(file);
              event.currentTarget.value = "";
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button
            onClick={() =>
              onApply({
                templateId: selectedTemplate.id,
                backgroundType: selectedTemplate.background,
                paperFormat: format,
                orientation,
              })
            }
          >
            <Check size={16} />
            Übernehmen
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TemplateLayer({
  templateId,
  backgroundType,
  compact,
}: {
  templateId?: string;
  backgroundType: PageWithElements["backgroundType"];
  compact?: boolean;
}) {
  const template = templates.find((item) => item.id === templateId);
  const preview = template?.preview ?? (backgroundType === "grid" ? "grid-medium" : backgroundType === "lined" ? "lined" : backgroundType === "dotted" ? "dots" : "blank");
  return (
    <div className="pointer-events-none absolute inset-0 h-full w-full">
      <TemplatePreview preview={preview} compact={compact} />
    </div>
  );
}

function TemplatePreview({ preview, compact }: { preview: PaperTemplate["preview"]; compact?: boolean }) {
  return (
    <div className="relative h-full w-full bg-white">
      <div className={templateBackgroundClass(preview)} />
      {preview === "cornell" ? <><div className="absolute bottom-[18%] left-0 right-0 border-t border-[#dbe4df]" /><div className="absolute bottom-[18%] left-[32%] top-0 border-l border-[#dbe4df]" /></> : null}
      {preview === "columns-1" ? <div className="absolute inset-y-4 left-8 border-l border-[#e2e8e2]" /> : null}
      {preview === "columns-2" ? <><div className="absolute inset-y-4 left-1/2 border-l border-[#dbe4df]" /><div className="absolute inset-y-4 left-8 border-l border-[#e2e8e2]" /></> : null}
      {preview === "columns-3" ? <><div className="absolute inset-y-4 left-1/3 border-l border-[#dbe4df]" /><div className="absolute inset-y-4 left-2/3 border-l border-[#dbe4df]" /></> : null}
      {preview === "margin" ? <div className="absolute inset-y-0 left-[14%] border-l-2 border-[#f1b7b7]" /> : null}
      {preview === "math" ? <><div className="absolute left-1/2 top-0 h-full border-l border-[#8fb4c7]" /><div className="absolute left-0 top-1/2 w-full border-t border-[#8fb4c7]" /></> : null}
      {preview === "planner-day" ? <PlannerBlocks count={compact ? 4 : 7} /> : null}
      {preview === "planner-week" ? <GridBlocks columns={7} rows={3} /> : null}
      {preview === "planner-month" ? <GridBlocks columns={7} rows={5} /> : null}
      {preview === "schedule" ? <GridBlocks columns={5} rows={7} /> : null}
      {preview === "study" ? <StudyBlocks /> : null}
      {preview === "flashcard" ? <GridBlocks columns={2} rows={4} rounded /> : null}
      {preview === "music" ? <MusicStaff /> : null}
      {preview === "project" ? <GridBlocks columns={3} rows={4} /> : null}
      {preview === "mindmap" ? <MindmapPreview /> : null}
      {preview === "slide" ? <div className="absolute inset-[12%] rounded-md border-2 border-[#dbe4df]" /> : null}
      {preview === "storyboard" ? <GridBlocks columns={2} rows={3} rounded /> : null}
      {preview === "formula" ? <FormulaPreview /> : null}
    </div>
  );
}

function templateBackgroundClass(preview: PaperTemplate["preview"]): string {
  if (preview === "dots") return "absolute inset-0 bg-[radial-gradient(#d5ddd7_1.2px,transparent_1.2px)] bg-[size:22px_22px]";
  if (preview === "grid-fine") return "absolute inset-0 bg-[linear-gradient(#edf1ec_1px,transparent_1px),linear-gradient(90deg,#edf1ec_1px,transparent_1px)] bg-[size:18px_18px]";
  if (preview === "grid-medium") return "absolute inset-0 bg-[linear-gradient(#edf1ec_1px,transparent_1px),linear-gradient(90deg,#edf1ec_1px,transparent_1px)] bg-[size:28px_28px]";
  if (preview === "grid-large") return "absolute inset-0 bg-[linear-gradient(#edf1ec_1px,transparent_1px),linear-gradient(90deg,#edf1ec_1px,transparent_1px)] bg-[size:42px_42px]";
  if (preview === "lined-tight") return "absolute inset-0 bg-[linear-gradient(#edf1ec_1px,transparent_1px)] bg-[size:100%_24px]";
  if (preview === "lined") return "absolute inset-0 bg-[linear-gradient(#edf1ec_1px,transparent_1px)] bg-[size:100%_32px]";
  if (preview === "lined-wide") return "absolute inset-0 bg-[linear-gradient(#edf1ec_1px,transparent_1px)] bg-[size:100%_42px]";
  return "absolute inset-0";
}

function PlannerBlocks({ count }: { count: number }) {
  return <div className="absolute inset-5 grid gap-2">{Array.from({ length: count }, (_, index) => <div key={index} className="rounded border border-[#dbe4df]" />)}</div>;
}

function GridBlocks({ columns, rows, rounded }: { columns: number; rows: number; rounded?: boolean }) {
  return <div className="absolute inset-5 grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>{Array.from({ length: columns * rows }, (_, index) => <div key={index} className={cx("border border-[#dbe4df]", rounded && "rounded-md")} />)}</div>;
}

function StudyBlocks() {
  return <><div className="absolute left-8 right-8 top-8 h-8 rounded border border-[#dbe4df]" /><div className="absolute left-8 top-24 h-28 w-1/2 rounded border border-[#dbe4df]" /><div className="absolute bottom-10 left-8 right-8 h-28 rounded border border-[#dbe4df]" /></>;
}

function MusicStaff() {
  return <div className="absolute inset-x-8 top-10 space-y-12">{Array.from({ length: 5 }, (_, staff) => <div key={staff} className="space-y-1">{Array.from({ length: 5 }, (_, line) => <div key={line} className="border-t border-[#cfd8d2]" />)}</div>)}</div>;
}

function MindmapPreview() {
  return <><div className="absolute left-1/2 top-1/2 h-12 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#bdd3ce]" /><div className="absolute left-[15%] top-[25%] h-8 w-16 rounded-full border border-[#dbe4df]" /><div className="absolute right-[12%] top-[30%] h-8 w-16 rounded-full border border-[#dbe4df]" /><div className="absolute bottom-[18%] left-[25%] h-8 w-20 rounded-full border border-[#dbe4df]" /></>;
}

function FormulaPreview() {
  return <><div className="absolute left-8 right-8 top-8 h-10 rounded border border-[#dbe4df]" /><div className="absolute left-8 right-8 top-24 grid grid-cols-2 gap-3">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-8 rounded border border-[#dbe4df]" />)}</div></>;
}

function TextControls({ element, onReplace }: { element: PageElement; onReplace: (element: PageElement, commit?: boolean) => void }) {
  const data = element.data as TextData;
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField label="Textgröße" value={data.fontSize} onChange={(fontSize) => onReplace({ ...element, data: { ...data, fontSize }, updatedAt: nowIso() })} />
      <label className="block text-xs font-medium text-[#667085]">
        Textfarbe
        <input type="color" value={data.color} onChange={(event) => onReplace({ ...element, data: { ...data, color: event.target.value }, updatedAt: nowIso() })} className="mt-1 h-9 w-full rounded-md border border-[#d9ded7] p-1" />
      </label>
    </div>
  );
}

function ShapeControls({ element, onReplace }: { element: PageElement; onReplace: (element: PageElement, commit?: boolean) => void }) {
  const data = element.data as ShapeData;
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs font-medium text-[#667085]">
        Farbe
        <input type="color" value={data.strokeColor} onChange={(event) => onReplace({ ...element, data: { ...data, strokeColor: event.target.value }, updatedAt: nowIso() })} className="mt-1 h-9 w-full rounded-md border border-[#d9ded7] p-1" />
      </label>
      <NumberField label="Linie" value={data.strokeWidth} onChange={(strokeWidth) => onReplace({ ...element, data: { ...data, strokeWidth }, updatedAt: nowIso() })} />
    </div>
  );
}

function TapeControls({ element, onReplace }: { element: PageElement; onReplace: (element: PageElement, commit?: boolean) => void }) {
  const data = element.data as TapeData;
  return (
    <label className="block text-xs font-medium text-[#667085]">
      Tape-Farbe
      <input type="color" value={data.color} onChange={(event) => onReplace({ ...element, data: { ...data, color: event.target.value }, updatedAt: nowIso() })} className="mt-1 h-9 w-full rounded-md border border-[#d9ded7] p-1" />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs font-medium text-[#667085]">
      {label}
      <input
        type="number"
        min="20"
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 h-9 w-full rounded-md border border-[#d9ded7] px-2 text-sm text-[#18202f]"
      />
    </label>
  );
}

function PanelTab({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button className={cx("min-h-11 border-b-2 px-2 text-xs font-semibold", active ? "border-[#2f6f73] text-[#2f6f73]" : "border-transparent text-[#667085] hover:bg-[#f1f4ef]")} onClick={onClick}>
      {children}
    </button>
  );
}

function createStrokeElement(pageId: string, stroke: Stroke): PageElement {
  const padding = Math.max(12, stroke.width * 2);
  const xs = stroke.points.map((point) => point.x);
  const ys = stroke.points.map((point) => point.y);
  const minX = clamp(Math.min(...xs) - padding, 0, pageWidth);
  const minY = clamp(Math.min(...ys) - padding, 0, pageHeight);
  const maxX = clamp(Math.max(...xs) + padding, 0, pageWidth);
  const maxY = clamp(Math.max(...ys) + padding, 0, pageHeight);
  const normalizedStroke: Stroke = {
    ...stroke,
    points: stroke.points.map((point) => ({ x: point.x - minX, y: point.y - minY })),
  };
  const timestamp = nowIso();
  return {
    id: createId("element"),
    pageId,
    type: stroke.tool === "marker" ? "highlight" : "drawing",
    x: minX,
    y: minY,
    width: Math.max(24, maxX - minX),
    height: Math.max(24, maxY - minY),
    zIndex: Number(new Date()),
    data: { strokes: [normalizedStroke] } satisfies DrawingData,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function elementTypeLabel(type: PageElement["type"]): string {
  const labels: Record<PageElement["type"], string> = {
    text: "Text",
    drawing: "Zeichnung",
    highlight: "Markierung",
    shape: "Form",
    table: "Tabelle",
    image: "Bild",
    pdf: "PDF",
    comment: "Kommentar",
    tape: "Tape",
  };
  return labels[type];
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function estimatePdfPages(file: File): Promise<number> {
  const text = await file.text().catch(() => "");
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return Math.max(1, matches?.length ?? 1);
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
