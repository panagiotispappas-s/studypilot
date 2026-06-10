"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  FolderPlus,
  MoreHorizontal,
  NotebookTabs,
  Pencil,
  Plus,
  Search,
  Star,
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

export function LibraryView() {
  const searchParams = useSearchParams();
  const selectedFolderId = searchParams.get("folder");
  const { folders, notebooks, pages, loading, refresh, search } = useStudyData();
  const [query, setQuery] = useState("");
  const [folderModal, setFolderModal] = useState<StudyFolder | "new" | null>(null);
  const [notebookModal, setNotebookModal] = useState<Notebook | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyFolder | Notebook | null>(null);

  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId) ?? folders[0];
  const visibleNotebooks = notebooks.filter((notebook) =>
    selectedFolder ? notebook.folderId === selectedFolder.id : true,
  );
  const recentNotebooks = [...notebooks]
    .sort((left, right) => (right.lastOpenedAt ?? "").localeCompare(left.lastOpenedAt ?? ""))
    .slice(0, 5);
  const favorites = notebooks.filter((notebook) => notebook.favorite);
  const results = useMemo(() => search(query), [query, search]);

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
            <div className="flex gap-1">
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
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleNotebooks.map((notebook) => (
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
