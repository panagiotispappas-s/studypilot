"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  BarChart3,
  BookOpenCheck,
  CalendarRange,
  Clock3,
  FolderPlus,
  Grid3X3,
  Layers3,
  List,
  MoreHorizontal,
  NotebookTabs,
  Pencil,
  Plus,
  Search,
  SortAsc,
  Star,
  Trophy,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { createFolder, deleteFolderCascade, updateFolder } from "@/lib/db/folders";
import { createNotebook, deleteNotebookCascade, updateNotebook } from "@/lib/db/notebooks";
import { createPage } from "@/lib/db/pages";
import { useStudyData } from "@/lib/db/useStudyData";
import { formatDate } from "@/lib/utils/date";
import { cx } from "@/lib/utils/format";
import type { Notebook, StudyFolder } from "@/types/study";

const folderColors = ["#2f6f73", "#4f6f52", "#7c5b38", "#6b5b95", "#a14f4f", "#2d5f89"];
type LibraryViewMode = "grid" | "list";
type LibrarySortMode = "updated" | "title" | "pages";

export function LibraryView() {
  const searchParams = useSearchParams();
  const selectedFolderId = searchParams.get("folder");
  const { folders, notebooks, pages, loading, refresh, search } = useStudyData();
  const [query, setQuery] = useState("");
  const [folderModal, setFolderModal] = useState<StudyFolder | "new" | null>(null);
  const [notebookModal, setNotebookModal] = useState<Notebook | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyFolder | Notebook | null>(null);
  const [viewMode, setViewMode] = useState<LibraryViewMode>("grid");
  const [sortMode, setSortMode] = useState<LibrarySortMode>("updated");
  const [referenceTime] = useState(() => Date.now());

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? folders[0];
  const visibleNotebooks = useMemo(() => {
    const filtered = notebooks.filter((notebook) => (selectedFolder ? notebook.folderId === selectedFolder.id : true));
    return [...filtered].sort((left, right) => {
      if (sortMode === "title") return left.title.localeCompare(right.title, "de");
      if (sortMode === "pages") {
        const leftPages = pages.filter((page) => page.notebookId === left.id).length;
        const rightPages = pages.filter((page) => page.notebookId === right.id).length;
        return rightPages - leftPages || left.title.localeCompare(right.title, "de");
      }
      return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
    });
  }, [notebooks, pages, selectedFolder, sortMode]);
  const recentNotebooks = [...notebooks]
    .sort((left, right) => (right.lastOpenedAt ?? "").localeCompare(left.lastOpenedAt ?? ""))
    .slice(0, 5);
  const favorites = notebooks.filter((notebook) => notebook.favorite);
  const results = useMemo(() => search(query), [query, search]);
  const metrics = useMemo(() => {
    const elementCount = pages.reduce((sum, page) => sum + page.elements.filter((element) => element.type !== "comment").length, 0);
    const textCount = pages.reduce((sum, page) => sum + page.elements.filter((element) => element.type === "text" || element.type === "table").length, 0);
    const activeThisWeek = notebooks.filter((notebook) => {
      const updated = new Date(notebook.updatedAt).getTime();
      return Number.isFinite(updated) && referenceTime - updated < 7 * 24 * 60 * 60 * 1000;
    }).length;
    return {
      folders: folders.length,
      notebooks: notebooks.length,
      pages: pages.length,
      elementCount,
      textCount,
      activeThisWeek,
    };
  }, [folders.length, notebooks, pages, referenceTime]);

  async function handleDelete() {
    if (!deleteTarget) return;
    if ("folderId" in deleteTarget) {
      await deleteNotebookCascade(deleteTarget.id);
    } else {
      await deleteFolderCascade(deleteTarget.id);
    }
    setDeleteTarget(null);
    await refresh();
  }

  return (
    <div>
      <header className="border-b border-[#dfe6df] bg-white px-5 py-6 lg:px-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-medium text-[#2f6f73]">StudyPilot</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Bibliothek</h1>
            <p className="mt-2 text-sm text-[#667085]">Notizen schreiben. Inhalte verstehen. Besser lernen.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setFolderModal("new")}>
              <FolderPlus size={17} />
              Ordner erstellen
            </Button>
            <Button onClick={() => setNotebookModal("new")} disabled={folders.length === 0}>
              <Plus size={17} />
              Notizbuch erstellen
            </Button>
          </div>
        </div>
        <div className="relative mt-5 max-w-2xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a2b3]" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ordner, Notizbücher, Texte, Karteikarten oder Quizfragen suchen"
            className="h-11 w-full rounded-md border border-[#d9ded7] bg-[#fbfcfa] pl-10 pr-4 text-sm outline-none focus:border-[#2f6f73] focus:ring-2 focus:ring-[#d8e9e4]"
          />
          {results.length > 0 ? (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-[#d9ded7] bg-white shadow-lg">
              {results.map((result) => (
                <Link key={`${result.type}-${result.id}`} href={result.href ?? "#"} className="block px-4 py-3 hover:bg-[#f4f7f3]">
                  <span className="block text-sm font-medium">{result.title}</span>
                  <span className="block text-xs text-[#667085]">{result.subtitle}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <LibraryCockpit
        metrics={metrics}
        recentNotebooks={recentNotebooks}
        favorites={favorites}
        pageCountForNotebook={(notebookId) => pages.filter((page) => page.notebookId === notebookId).length}
      />

      <div className="grid gap-6 px-5 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[#475467]">Ordner</h2>
          {loading ? <p className="text-sm text-[#667085]">Lade Bibliothek...</p> : null}
          {!loading && folders.length === 0 ? (
            <EmptyState
              title="Noch keine Ordner."
              description="Erstelle dein erstes Fach und starte dein erstes Notizbuch."
              action={<Button onClick={() => setFolderModal("new")}>Ordner erstellen</Button>}
            />
          ) : null}
          <div className="space-y-2">
            {folders.map((folder) => {
              const folderNotebooks = notebooks.filter((notebook) => notebook.folderId === folder.id);
              const folderPages = pages.filter((page) => folderNotebooks.some((notebook) => notebook.id === page.notebookId));
              return (
                <Link
                  key={folder.id}
                  href={`/library?folder=${folder.id}`}
                  className={cx(
                    "block rounded-lg border bg-white p-4 transition hover:border-[#aac7c1]",
                    selectedFolder?.id === folder.id ? "border-[#2f6f73] shadow-sm" : "border-[#dfe6df]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-4 w-4 rounded" style={{ background: folder.color ?? "#2f6f73" }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{folder.name}</span>
                      <span className="mt-1 block text-xs text-[#667085]">
                        {folderNotebooks.length} Notizbücher · {folderPages.length} Seiten
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 space-y-6">
          <Panel title={selectedFolder ? selectedFolder.name : "Ordner-Ansicht"} action={selectedFolder ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="flex h-9 items-center gap-2 rounded-md border border-[#d9ded7] bg-white px-2 text-xs font-medium text-[#475467]">
                <SortAsc size={14} />
                <select value={sortMode} onChange={(event) => setSortMode(event.target.value as LibrarySortMode)} className="bg-transparent outline-none">
                  <option value="updated">Aktualisiert</option>
                  <option value="title">Titel</option>
                  <option value="pages">Seiten</option>
                </select>
              </label>
              <div className="flex rounded-md border border-[#d9ded7] bg-white p-0.5">
                <button className={cx("flex h-8 w-8 items-center justify-center rounded", viewMode === "grid" ? "bg-[#e8f3f1] text-[#2f6f73]" : "text-[#667085]")} onClick={() => setViewMode("grid")} aria-label="Rasteransicht">
                  <Grid3X3 size={15} />
                </button>
                <button className={cx("flex h-8 w-8 items-center justify-center rounded", viewMode === "list" ? "bg-[#e8f3f1] text-[#2f6f73]" : "text-[#667085]")} onClick={() => setViewMode("list")} aria-label="Listenansicht">
                  <List size={16} />
                </button>
              </div>
              <Button variant="ghost" className="h-9 w-9 p-0" onClick={() => setFolderModal(selectedFolder)} aria-label="Ordner bearbeiten">
                <Pencil size={16} />
              </Button>
              <Button variant="ghost" className="h-9 w-9 p-0 text-[#b54747]" onClick={() => setDeleteTarget(selectedFolder)} aria-label="Ordner löschen">
                <Trash2 size={16} />
              </Button>
            </div>
          ) : null}>
            {visibleNotebooks.length === 0 ? (
              <EmptyState
                title="Noch keine Notizbücher."
                description="Erstelle ein Notizbuch in diesem Fach und beginne mit deinen Seiten."
                action={<Button onClick={() => setNotebookModal("new")} disabled={!selectedFolder}>Notizbuch erstellen</Button>}
              />
            ) : (
              <div className={viewMode === "grid" ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
                {visibleNotebooks.map((notebook) => (
                  viewMode === "grid" ? (
                    <NotebookCard
                      key={notebook.id}
                      notebook={notebook}
                      pageCount={pages.filter((page) => page.notebookId === notebook.id).length}
                      onEdit={() => setNotebookModal(notebook)}
                      onDelete={() => setDeleteTarget(notebook)}
                      onToggleFavorite={async () => {
                        await updateNotebook(notebook.id, { favorite: !notebook.favorite });
                        await refresh();
                      }}
                    />
                  ) : (
                    <NotebookRow
                      key={notebook.id}
                      notebook={notebook}
                      pageCount={pages.filter((page) => page.notebookId === notebook.id).length}
                      onEdit={() => setNotebookModal(notebook)}
                      onDelete={() => setDeleteTarget(notebook)}
                      onToggleFavorite={async () => {
                        await updateNotebook(notebook.id, { favorite: !notebook.favorite });
                        await refresh();
                      }}
                    />
                  )
                ))}
              </div>
            )}
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Zuletzt geöffnet">
              {recentNotebooks.length === 0 ? (
                <p className="text-sm text-[#667085]">Geöffnete Notizbücher erscheinen hier.</p>
              ) : (
                <NotebookList notebooks={recentNotebooks} pages={pages} />
              )}
            </Panel>
            <Panel title="Favoriten">
              {favorites.length === 0 ? (
                <p className="text-sm text-[#667085]">Markierte Notizbücher erscheinen hier.</p>
              ) : (
                <NotebookList notebooks={favorites} pages={pages} />
              )}
            </Panel>
          </div>
        </section>
      </div>

      {folderModal ? (
        <FolderForm
          folder={folderModal === "new" ? undefined : folderModal}
          onClose={() => setFolderModal(null)}
          onSaved={async () => {
            setFolderModal(null);
            await refresh();
          }}
        />
      ) : null}

      {notebookModal ? (
        <NotebookForm
          notebook={notebookModal === "new" ? undefined : notebookModal}
          folders={folders}
          selectedFolderId={selectedFolder?.id}
          onClose={() => setNotebookModal(null)}
          onSaved={async (notebookId) => {
            setNotebookModal(null);
            if (notebookId) await createPage(notebookId);
            await refresh();
          }}
        />
      ) : null}

      {deleteTarget ? (
        <Modal title="Löschen bestätigen" onClose={() => setDeleteTarget(null)}>
          <p className="text-sm leading-6 text-[#475467]">
            {`"${"folderId" in deleteTarget ? deleteTarget.title : deleteTarget.name}" wird dauerhaft gelöscht.`}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Abbrechen</Button>
            <Button variant="danger" onClick={handleDelete}>Löschen</Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function LibraryCockpit({
  metrics,
  recentNotebooks,
  favorites,
  pageCountForNotebook,
}: {
  metrics: {
    folders: number;
    notebooks: number;
    pages: number;
    elementCount: number;
    textCount: number;
    activeThisWeek: number;
  };
  recentNotebooks: Notebook[];
  favorites: Notebook[];
  pageCountForNotebook: (notebookId: string) => number;
}) {
  const focusNotebook = recentNotebooks[0] ?? favorites[0];
  return (
    <section className="border-b border-[#dfe6df] bg-[#f9fbf8] px-5 py-5 lg:px-8">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Layers3} label="Fächer" value={metrics.folders} hint={`${metrics.notebooks} Notizbücher`} />
          <MetricCard icon={BookOpenCheck} label="Seiten" value={metrics.pages} hint={`${metrics.elementCount} Elemente`} />
          <MetricCard icon={BarChart3} label="Auswertbar" value={metrics.textCount} hint="Text- und Tabellenbereiche" />
          <MetricCard icon={Trophy} label="Aktiv" value={metrics.activeThisWeek} hint="Notizbücher diese Woche" />
        </div>
        <div className="rounded-lg border border-[#dfe6df] bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#e8f3f1] text-[#2f6f73]">
              <CalendarRange size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Nächster sinnvoller Schritt</p>
              {focusNotebook ? (
                <>
                  <p className="mt-1 text-sm leading-6 text-[#667085]">
                    Öffne „{focusNotebook.title}“ und verwandle die letzten Notizen in Karteikarten oder ein Quiz.
                  </p>
                  <Link href={`/notebook/${focusNotebook.id}`} className="mt-3 inline-flex text-sm font-medium text-[#2f6f73]">
                    Weiterarbeiten · {pageCountForNotebook(focusNotebook.id)} Seiten
                  </Link>
                </>
              ) : (
                <p className="mt-1 text-sm leading-6 text-[#667085]">Lege ein Fach und ein Notizbuch an, um dein Lernsystem aufzubauen.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Layers3;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <article className="rounded-lg border border-[#dfe6df] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#eef3ee] text-[#2f6f73]">
          <Icon size={18} />
        </span>
        <span className="text-2xl font-semibold">{value}</span>
      </div>
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-[#667085]">{hint}</p>
    </article>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#dfe6df] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function NotebookRow({
  notebook,
  pageCount,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  notebook: Notebook;
  pageCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <article className="flex items-center gap-3 rounded-lg border border-[#dfe6df] bg-[#fbfcfa] p-3">
      <Link href={`/notebook/${notebook.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md text-white shadow-sm" style={{ background: notebook.coverColor ?? "#2f6f73" }}>
          <NotebookTabs size={20} />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{notebook.title}</span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#667085]">
            <span>{pageCount} Seiten</span>
            <span className="inline-flex items-center gap-1"><Clock3 size={12} /> {formatDate(notebook.updatedAt)}</span>
          </span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" className="h-8 w-8 p-0" onClick={onToggleFavorite} aria-label="Favorit setzen">
          <Star size={16} className={notebook.favorite ? "fill-[#d6a642] text-[#d6a642]" : ""} />
        </Button>
        <Button variant="ghost" className="h-8 w-8 p-0" onClick={onEdit} aria-label="Notizbuch bearbeiten">
          <MoreHorizontal size={16} />
        </Button>
        <Button variant="ghost" className="h-8 w-8 p-0 text-[#b54747]" onClick={onDelete} aria-label="Notizbuch löschen">
          <Trash2 size={16} />
        </Button>
      </div>
    </article>
  );
}

function NotebookCard({
  notebook,
  pageCount,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  notebook: Notebook;
  pageCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <article className="rounded-lg border border-[#dfe6df] bg-[#fbfcfa] p-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/notebook/${notebook.id}`} className="min-w-0 flex-1">
          <div className="mb-4 h-16 rounded-md" style={{ background: notebook.coverColor ?? "#e8f3f1" }} />
          <h3 className="truncate font-semibold">{notebook.title}</h3>
          <p className="mt-1 text-xs text-[#667085]">{pageCount} Seiten · aktualisiert {formatDate(notebook.updatedAt)}</p>
        </Link>
        <div className="flex flex-col gap-1">
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={onToggleFavorite} aria-label="Favorit setzen">
            <Star size={16} className={notebook.favorite ? "fill-[#d6a642] text-[#d6a642]" : ""} />
          </Button>
          <Button variant="ghost" className="h-8 w-8 p-0" onClick={onEdit} aria-label="Notizbuch bearbeiten">
            <MoreHorizontal size={16} />
          </Button>
          <Button variant="ghost" className="h-8 w-8 p-0 text-[#b54747]" onClick={onDelete} aria-label="Notizbuch löschen">
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </article>
  );
}

function NotebookList({ notebooks, pages }: { notebooks: Notebook[]; pages: { notebookId: string }[] }) {
  return (
    <div className="divide-y divide-[#edf1ec]">
      {notebooks.map((notebook) => (
        <Link key={notebook.id} href={`/notebook/${notebook.id}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e8f3f1] text-[#2f6f73]">
            <NotebookTabs size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{notebook.title}</span>
            <span className="text-xs text-[#667085]">{pages.filter((page) => page.notebookId === notebook.id).length} Seiten</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function FolderForm({
  folder,
  onClose,
  onSaved,
}: {
  folder?: StudyFolder;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [description, setDescription] = useState(folder?.description ?? "");
  const [color, setColor] = useState(folder?.color ?? folderColors[0]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    if (folder) await updateFolder(folder.id, { name, description, color });
    else await createFolder({ name, description, color });
    await onSaved();
  }

  return (
    <Modal title={folder ? "Ordner bearbeiten" : "Ordner erstellen"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" value={name} onChange={setName} required />
        <Field label="Beschreibung" value={description} onChange={setDescription} />
        <div>
          <label className="text-sm font-medium">Farbe</label>
          <div className="mt-2 flex gap-2">
            {folderColors.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className={cx("h-8 w-8 rounded-md border-2", color === candidate ? "border-[#18202f]" : "border-transparent")}
                style={{ background: candidate }}
                onClick={() => setColor(candidate)}
                aria-label={`Farbe ${candidate}`}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button type="submit">{folder ? "Speichern" : "Erstellen"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function NotebookForm({
  notebook,
  folders,
  selectedFolderId,
  onClose,
  onSaved,
}: {
  notebook?: Notebook;
  folders: StudyFolder[];
  selectedFolderId?: string;
  onClose: () => void;
  onSaved: (notebookId?: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(notebook?.title ?? "");
  const [folderId, setFolderId] = useState(notebook?.folderId ?? selectedFolderId ?? folders[0]?.id ?? "");
  const [coverColor, setCoverColor] = useState(notebook?.coverColor ?? "#e8f3f1");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !folderId) return;
    if (notebook) {
      await updateNotebook(notebook.id, { title, folderId, coverColor });
      await onSaved();
    } else {
      const created = await createNotebook({ title, folderId, coverColor });
      await onSaved(created.id);
    }
  }

  return (
    <Modal title={notebook ? "Notizbuch bearbeiten" : "Notizbuch erstellen"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Titel" value={title} onChange={setTitle} required />
        <div>
          <label className="text-sm font-medium">Ordner</label>
          <select
            value={folderId}
            onChange={(event) => setFolderId(event.target.value)}
            className="mt-2 h-10 w-full rounded-md border border-[#d9ded7] bg-white px-3 text-sm outline-none focus:border-[#2f6f73]"
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.name}</option>
            ))}
          </select>
        </div>
        <Field label="Cover-Farbe" type="color" value={coverColor} onChange={setCoverColor} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button type="submit">{notebook ? "Speichern" : "Erstellen"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        value={value}
        required={required}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-[#d9ded7] bg-white px-3 text-sm outline-none focus:border-[#2f6f73]"
      />
    </label>
  );
}
