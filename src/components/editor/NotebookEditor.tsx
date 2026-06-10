"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type PointerEvent } from "react";
import {
  ArrowLeft,
  Bot,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  MessageSquare,
  MousePointer2,
  PenLine,
  Plus,
  Save,
  Square,
  Table2,
  Trash2,
  Type,
  Upload,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { createPage, deleteElement, deletePage, duplicatePage, movePage, updatePage, upsertElement } from "@/lib/db/pages";
import { db } from "@/lib/db/indexeddb";
import { saveImportedPdf } from "@/lib/db/pdfs";
import { touchNotebook, updateNotebook } from "@/lib/db/notebooks";
import { useStudyData } from "@/lib/db/useStudyData";
import { distanceToStroke, getRelativePoint, pointsToPath } from "@/lib/editor/canvasUtils";
import {
  createCommentElement,
  createId,
  createImageElement,
  createPdfElement,
  createShapeElement,
  createTableElement,
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
  TableData,
  TextData,
} from "@/types/study";

type EditorTool = "select" | "pen" | "marker" | "eraser" | "text" | "shape" | "table" | "image" | "comment" | "pdf";

const pageWidth = 794;
const pageHeight = 1123;

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
  const [savedAt, setSavedAt] = useState<string>("Gespeichert");
  const [zoom, setZoom] = useState(1);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0],
    [activePageId, pages],
  );
  const selectedElement = activePage?.elements.find((element) => element.id === selectedElementId) ?? null;

  useEffect(() => {
    if (!activePageId && pages[0]) {
      queueMicrotask(() => setActivePageId(pages[0].id));
    }
  }, [activePageId, pages]);

  useEffect(() => {
    void touchNotebook(notebookId);
  }, [notebookId]);

  const markSaved = useCallback(() => {
    setSavedAt("Gespeichert");
  }, []);

  const persistElement = useCallback(
    async (element: PageElement) => {
      setSavedAt("Speichert...");
      await upsertElement({ ...element, updatedAt: nowIso() });
      await refresh();
      markSaved();
    },
    [markSaved, refresh],
  );

  async function addPage() {
    const page = await createPage(notebookId);
    setActivePageId(page.id);
    await refresh();
  }

  async function removePage(page: PageWithElements) {
    if (!confirm(`Seite ${page.pageNumber} löschen?`)) return;
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
      await persistElement(createTextElement(activePage.id, point.x, point.y));
      setTool("select");
      return;
    }

    if (tool === "shape") {
      await persistElement(createShapeElement(activePage.id, point.x, point.y, shapeType, strokeColor, strokeWidth));
      setTool("select");
      return;
    }

    if (tool === "table") {
      await persistElement(createTableElement(activePage.id, point.x, point.y, tableRows, tableColumns));
      setTool("select");
      return;
    }

    if (tool === "comment") {
      await persistElement(createCommentElement(activePage.id, point.x, point.y));
      setTool("select");
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
    const type = currentStroke.tool === "marker" ? "highlight" : "drawing";
    const timestamp = nowIso();
    await persistElement({
      id: createId("element"),
      pageId: activePage.id,
      type,
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      zIndex: Date.now(),
      data: { strokes: [currentStroke] } satisfies DrawingData,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    setCurrentStroke(null);
  }

  async function eraseAt(point: Point) {
    if (!activePage) return;
    const target = activePage.elements.find((element) => {
      if (element.type !== "drawing" && element.type !== "highlight") return false;
      return (element.data as DrawingData).strokes.some((stroke) => distanceToStroke(point, stroke) < Math.max(14, stroke.width * 2));
    });
    if (target) {
      await deleteElement(target.id);
      await refresh();
    }
  }

  async function updateElement(element: PageElement, patch: Partial<PageElement>) {
    await persistElement({ ...element, ...patch, updatedAt: nowIso() });
  }

  async function removeSelectedElement() {
    if (!selectedElement) return;
    await deleteElement(selectedElement.id);
    setSelectedElementId(null);
    await refresh();
  }

  async function importFile(file: File, kind: "image" | "pdf") {
    if (!activePage) return;
    const dataUrl = await fileToDataUrl(file);
    if (kind === "image") {
      await persistElement(createImageElement(activePage.id, {
        name: file.name,
        dataUrl,
        mimeType: file.type,
      } satisfies ImageData));
    } else {
      await persistElement(createPdfElement(activePage.id, {
        name: file.name,
        dataUrl,
        pageCount: await estimatePdfPages(file),
      } satisfies PdfData));
      await saveImportedPdf({
        id: createId("pdf"),
        pageId: activePage.id,
        notebookId,
        name: file.name,
        dataUrl,
        pageCount: await estimatePdfPages(file),
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
    const importedPdfs = await db.importedPdfs.where("notebookId").equals(notebook.id).toArray();
    downloadText(`${notebook.title}.json`, JSON.stringify({ notebook, pages: allPages, elements, importedPdfs }, null, 2), "application/json");
  }

  if (loading) {
    return <div className="p-8 text-sm text-[#667085]">Lade Notizbuch...</div>;
  }

  if (!notebook) {
    return (
      <div className="p-8">
        <EmptyState title="Notizbuch nicht gefunden." action={<Link href="/library" className="text-sm font-medium text-[#2f6f73]">Zur Bibliothek</Link>} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7f4]">
      <header className="sticky top-0 z-20 border-b border-[#dfe6df] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/library" className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-[#f1f4ef]" aria-label="Zur Bibliothek">
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
                {activePage ? `Seite ${activePage.pageNumber} von ${pages.length}` : `${pages.length} Seiten`} · {savedAt}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportNotebook}>
              <Save size={16} />
              JSON
            </Button>
            <label className="hidden items-center gap-2 rounded-md border border-[#d9ded7] bg-white px-3 py-2 text-sm font-medium text-[#334155] lg:flex">
              <ZoomIn size={16} />
              <input
                type="range"
                min="0.75"
                max="1.4"
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
              KI für diese Seite
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

      <div className="grid flex-1 gap-0 lg:grid-cols-[230px_minmax(0,1fr)_280px]">
        <aside className="border-b border-[#dfe6df] bg-white p-4 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Seiten</h2>
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
            <div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-2 lg:overflow-visible">
              {pages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => setActivePageId(page.id)}
                  className={cx(
                    "min-w-36 rounded-md border p-3 text-left transition lg:w-full",
                    activePage?.id === page.id ? "border-[#2f6f73] bg-[#e8f3f1]" : "border-[#dfe6df] bg-white hover:bg-[#f7faf6]",
                  )}
                >
                  <span className="block text-sm font-medium">{page.title || `Seite ${page.pageNumber}`}</span>
                  <span className="mt-1 block text-xs text-[#667085]">{page.elements.length} Elemente</span>
                </button>
              ))}
            </div>
          )}
          {activePage ? (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={async () => { await duplicatePage(activePage); await refresh(); }}>Duplizieren</Button>
              <Button variant="secondary" onClick={async () => { await movePage(activePage.id, -1); await refresh(); }}>Hoch</Button>
              <Button variant="secondary" onClick={async () => { await movePage(activePage.id, 1); await refresh(); }}>Runter</Button>
              <Button variant="danger" onClick={() => removePage(activePage)}>Löschen</Button>
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 overflow-auto p-4 lg:p-8">
          {activePage ? (
            <div className="mx-auto w-full max-w-[900px]">
              <div className="origin-top transition-transform" style={{ transform: `scale(${zoom})` }}>
                <div
                  ref={pageRef}
                  className={cx(
                    "relative mx-auto aspect-[794/1123] w-full max-w-[794px] touch-none overflow-hidden rounded-md border border-[#d9ded7] bg-white shadow-sm",
                    backgroundClass(activePage.backgroundType),
                  )}
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
                ) : null}
                <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${pageWidth} ${pageHeight}`}>
                  {activePage.elements
                    .filter((element) => element.type === "highlight" || element.type === "drawing")
                    .map((element) => (
                      <DrawingElement key={element.id} element={element} />
                    ))}
                  {currentStroke ? <StrokePath stroke={currentStroke} /> : null}
                </svg>

                {activePage.elements
                  .filter((element) => element.type !== "drawing" && element.type !== "highlight")
                  .map((element) => (
                    <EditableElement
                      key={element.id}
                      element={element}
                      selected={selectedElementId === element.id}
                      setSelected={() => setSelectedElementId(element.id)}
                      updateElement={updateElement}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </main>

        <aside className="border-t border-[#dfe6df] bg-white p-4 lg:border-l lg:border-t-0">
          <Inspector
            selectedElement={selectedElement}
            activePage={activePage}
            onDelete={removeSelectedElement}
            onUpdate={updateElement}
            onUpdatePage={async (patch) => {
              if (!activePage) return;
              setSavedAt("Speichert...");
              await updatePage(activePage.id, patch);
              await refresh();
              markSaved();
            }}
          />
        </aside>
      </div>

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
    { id: "image", label: "Bild", icon: ImageIcon, action: props.onImage },
    { id: "comment", label: "Kommentar", icon: MessageSquare },
    { id: "pdf", label: "PDF", icon: Upload, action: props.onPdf },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[#edf1ec] px-4 py-2 lg:px-6">
      {tools.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.id}
            variant={props.tool === item.id ? "primary" : "secondary"}
            className="h-10 px-3"
            onClick={() => {
              props.setTool(item.id);
              item.action?.();
            }}
            title={item.label}
          >
            <Icon size={17} />
            <span className="hidden xl:inline">{item.label}</span>
          </Button>
        );
      })}
      <span className="mx-1 hidden h-8 w-px bg-[#dfe6df] sm:block" />
      <input
        type="color"
        value={props.strokeColor}
        onChange={(event) => props.setStrokeColor(event.target.value)}
        className="h-10 w-11 rounded-md border border-[#d9ded7] bg-white p-1"
        aria-label="Farbe"
      />
      <input
        type="range"
        min="1"
        max="12"
        value={props.strokeWidth}
        onChange={(event) => props.setStrokeWidth(Number(event.target.value))}
        className="w-24"
        aria-label="Linienstärke"
      />
      {props.tool === "shape" ? (
        <select
          value={props.shapeType}
          onChange={(event) => props.setShapeType(event.target.value as ShapeData["shapeType"])}
          className="h-10 rounded-md border border-[#d9ded7] bg-white px-2 text-sm"
        >
          <option value="rectangle">Rechteck</option>
          <option value="circle">Kreis</option>
          <option value="line">Linie</option>
          <option value="arrow">Pfeil</option>
        </select>
      ) : null}
      {props.tool === "table" ? (
        <div className="flex items-center gap-2 text-sm">
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

function backgroundClass(type: PageWithElements["backgroundType"]): string {
  if (type === "grid") return "bg-[linear-gradient(#eef2ee_1px,transparent_1px),linear-gradient(90deg,#eef2ee_1px,transparent_1px)] bg-[size:28px_28px]";
  if (type === "lined") return "bg-[linear-gradient(#eef2ee_1px,transparent_1px)] bg-[size:100%_32px]";
  if (type === "dotted") return "bg-[radial-gradient(#dfe6df_1.2px,transparent_1.2px)] bg-[size:22px_22px]";
  return "";
}

function DrawingElement({ element }: { element: PageElement }) {
  return (element.data as DrawingData).strokes.map((stroke) => <StrokePath key={stroke.id} stroke={stroke} />);
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
      opacity={stroke.tool === "marker" ? 0.65 : 1}
    />
  );
}

function EditableElement({
  element,
  selected,
  setSelected,
  updateElement,
}: {
  element: PageElement;
  selected: boolean;
  setSelected: () => void;
  updateElement: (element: PageElement, patch: Partial<PageElement>) => Promise<void>;
}) {
  const [dragStart, setDragStart] = useState<{ point: Point; origin: Point } | null>(null);
  const style = {
    left: `${(element.x / pageWidth) * 100}%`,
    top: `${(element.y / pageHeight) * 100}%`,
    width: `${((element.width ?? 160) / pageWidth) * 100}%`,
    height: `${((element.height ?? 100) / pageHeight) * 100}%`,
    zIndex: element.zIndex,
  };

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    setSelected();
    setDragStart({ point: { x: event.clientX, y: event.clientY }, origin: { x: element.x, y: element.y } });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  async function move(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart) return;
    const parent = event.currentTarget.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const dx = ((event.clientX - dragStart.point.x) / rect.width) * pageWidth;
    const dy = ((event.clientY - dragStart.point.y) / rect.height) * pageHeight;
    await updateElement(element, {
      x: clamp(dragStart.origin.x + dx, 0, pageWidth - (element.width ?? 80)),
      y: clamp(dragStart.origin.y + dy, 0, pageHeight - (element.height ?? 80)),
    });
  }

  return (
    <div
      className={cx("absolute", selected && "outline outline-2 outline-[#2f6f73]")}
      style={style}
      onPointerDown={(event) => {
        event.stopPropagation();
        setSelected();
      }}
    >
      {selected ? (
        <div
          className="absolute -top-7 left-0 z-20 flex h-6 items-center rounded-md bg-[#2f6f73] px-2 text-xs font-medium text-white"
          onPointerDown={startDrag}
          onPointerMove={move}
          onPointerUp={() => setDragStart(null)}
        >
          Verschieben
        </div>
      ) : null}
      <ElementContent element={element} updateElement={updateElement} />
    </div>
  );
}

function ElementContent({
  element,
  updateElement,
}: {
  element: PageElement;
  updateElement: (element: PageElement, patch: Partial<PageElement>) => Promise<void>;
}) {
  if (element.type === "text") {
    const data = element.data as TextData;
    return (
      <textarea
        value={data.text}
        onChange={(event) => void updateElement(element, { data: { ...data, text: event.target.value } })}
        placeholder="Schreiben..."
        className="h-full w-full resize-none rounded-sm border border-transparent bg-white/80 p-2 leading-6 outline-none focus:border-[#aac7c1]"
        style={{ fontSize: data.fontSize, color: data.color }}
      />
    );
  }

  if (element.type === "shape") {
    const data = element.data as ShapeData;
    return <ShapeView data={data} />;
  }

  if (element.type === "table") {
    const data = element.data as TableData;
    return (
      <div className="h-full w-full overflow-hidden border border-[#98a2b3] bg-white">
        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${data.columns}, minmax(0, 1fr))` }}>
          {data.cells.map((row, rowIndex) =>
            row.map((cell, columnIndex) => (
              <textarea
                key={`${rowIndex}-${columnIndex}`}
                value={cell}
                onChange={(event) => {
                  const cells = data.cells.map((sourceRow) => [...sourceRow]);
                  cells[rowIndex][columnIndex] = event.target.value;
                  void updateElement(element, { data: { ...data, cells } });
                }}
                className="resize-none border-b border-r border-[#d0d5dd] p-1 text-xs outline-none focus:bg-[#f7fbfa]"
              />
            )),
          )}
        </div>
      </div>
    );
  }

  if (element.type === "image") {
    const data = element.data as ImageData;
    return <img src={data.dataUrl} alt={data.name} className="h-full w-full object-contain" />;
  }

  if (element.type === "pdf") {
    const data = element.data as PdfData;
    return (
      <div className="h-full w-full overflow-hidden rounded-sm border border-[#d9ded7] bg-white">
        <iframe src={data.dataUrl} title={data.name} className="h-full w-full" />
      </div>
    );
  }

  const data = element.data as CommentData;
  return (
    <textarea
      value={data.text}
      onChange={(event) => void updateElement(element, { data: { ...data, text: event.target.value } })}
      placeholder="Kommentar"
      className="h-full w-full resize-none rounded-md border border-[#e2d29b] bg-[#fff8d8] p-3 text-sm shadow-sm outline-none focus:border-[#b9973a]"
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

function Inspector({
  selectedElement,
  activePage,
  onDelete,
  onUpdate,
  onUpdatePage,
}: {
  selectedElement: PageElement | null;
  activePage?: PageWithElements;
  onDelete: () => Promise<void>;
  onUpdate: (element: PageElement, patch: Partial<PageElement>) => Promise<void>;
  onUpdatePage: (patch: Partial<PageWithElements>) => Promise<void>;
}) {
  const comments = activePage?.elements.filter((element) => element.type === "comment") ?? [];
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
            <label className="block text-xs font-medium text-[#667085]">
              Hintergrund
              <select
                value={activePage.backgroundType}
                onChange={(event) => void onUpdatePage({ backgroundType: event.target.value as PageWithElements["backgroundType"] })}
                className="mt-1 h-9 w-full rounded-md border border-[#d9ded7] px-2 text-sm text-[#18202f] outline-none focus:border-[#2f6f73]"
              >
                <option value="blank">Blanko</option>
                <option value="lined">Liniert</option>
                <option value="grid">Kariert</option>
                <option value="dotted">Gepunktet</option>
                {activePage.backgroundPdf ? <option value="pdf">PDF-Hintergrund</option> : null}
              </select>
            </label>
          </div>
        </section>
      ) : null}
      <section>
        <h2 className="text-sm font-semibold">Eigenschaften</h2>
        {!selectedElement ? (
          <p className="mt-2 text-sm leading-6 text-[#667085]">Wähle ein Element aus, um es zu verschieben, zu bearbeiten oder zu löschen.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-[#667085]">Typ: {elementTypeLabel(selectedElement.type)}</p>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Breite" value={selectedElement.width ?? 120} onChange={(width) => onUpdate(selectedElement, { width })} />
              <NumberField label="Höhe" value={selectedElement.height ?? 80} onChange={(height) => onUpdate(selectedElement, { height })} />
            </div>
            {selectedElement.type === "text" ? (
              <NumberField
                label="Textgröße"
                value={(selectedElement.data as TextData).fontSize}
                onChange={(fontSize) => onUpdate(selectedElement, { data: { ...(selectedElement.data as TextData), fontSize } })}
              />
            ) : null}
            {selectedElement.type === "shape" ? (
              <ShapeControls element={selectedElement} onUpdate={onUpdate} />
            ) : null}
            {selectedElement.type === "pdf" ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => onUpdatePage({ backgroundType: "pdf", backgroundPdf: selectedElement.data as PdfData })}
              >
                Als Seitenhintergrund
              </Button>
            ) : null}
            <Button variant="danger" className="w-full" onClick={onDelete}>
              <Trash2 size={16} />
              Element löschen
            </Button>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold">Kommentare</h2>
        {comments.length === 0 ? (
          <p className="mt-2 text-sm text-[#667085]">Kommentare dieser Seite erscheinen hier.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-md border border-[#efe1a6] bg-[#fff9df] p-3 text-sm">
                {(comment.data as CommentData).text || "Leerer Kommentar"}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ShapeControls({
  element,
  onUpdate,
}: {
  element: PageElement;
  onUpdate: (element: PageElement, patch: Partial<PageElement>) => Promise<void>;
}) {
  const data = element.data as ShapeData;
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block text-xs font-medium text-[#667085]">
        Farbe
        <input
          type="color"
          value={data.strokeColor}
          onChange={(event) => onUpdate(element, { data: { ...data, strokeColor: event.target.value } })}
          className="mt-1 h-9 w-full rounded-md border border-[#d9ded7] p-1"
        />
      </label>
      <NumberField
        label="Linie"
        value={data.strokeWidth}
        onChange={(strokeWidth) => onUpdate(element, { data: { ...data, strokeWidth } })}
      />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs font-medium text-[#667085]">
      {label}
      <input
        type="number"
        min="24"
        value={Math.round(value)}
        onChange={(event) => void onChange(Number(event.target.value))}
        className="mt-1 h-9 w-full rounded-md border border-[#d9ded7] px-2 text-sm text-[#18202f]"
      />
    </label>
  );
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
