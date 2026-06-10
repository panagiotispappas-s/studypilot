"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Download, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { deleteFlashcard, updateFlashcard } from "@/lib/db/flashcards";
import { useStudyData } from "@/lib/db/useStudyData";
import { nowIso } from "@/lib/utils/date";
import { downloadText } from "@/lib/utils/format";
import type { StudyCard } from "@/types/study";

export function FlashcardsView() {
  const { folders, notebooks, flashcards, refresh } = useStudyData();
  const [folderFilter, setFolderFilter] = useState("");
  const [notebookFilter, setNotebookFilter] = useState("");
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<StudyCard | null>(null);

  const filtered = useMemo(
    () =>
      flashcards.filter((card) => {
        if (folderFilter && card.folderId !== folderFilter) return false;
        if (notebookFilter && card.notebookId !== notebookFilter) return false;
        return true;
      }),
    [flashcards, folderFilter, notebookFilter],
  );

  async function mark(card: StudyCard, known: boolean) {
    await updateFlashcard(card.id, {
      knownCount: card.knownCount + (known ? 1 : 0),
      unknownCount: card.unknownCount + (known ? 0 : 1),
      lastReviewedAt: nowIso(),
    });
    await refresh();
  }

  function exportCsv() {
    const csv = ["Vorderseite,Rückseite,Schwierigkeit"].concat(
      filtered.map((card) => [card.front, card.back, card.difficulty ?? ""].map((value) => `"${value.replaceAll('"', '""')}"`).join(",")),
    );
    downloadText("karteikarten.csv", csv.join("\n"), "text/csv");
  }

  return (
    <div>
      <PageHeader
        title="Karteikarten"
        subtitle="Wiederhole erzeugte Karten und markiere, was sicher sitzt."
        actions={filtered.length > 0 ? <Button variant="secondary" onClick={exportCsv}><Download size={16} /> CSV</Button> : null}
      />
      <div className="px-5 py-6 lg:px-8">
        <div className="mb-5 flex flex-wrap gap-3">
          <Filter label="Ordner" value={folderFilter} onChange={setFolderFilter} options={folders.map((folder) => [folder.id, folder.name])} />
          <Filter label="Notizbuch" value={notebookFilter} onChange={setNotebookFilter} options={notebooks.map((notebook) => [notebook.id, notebook.title])} />
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="Noch keine Karteikarten." description="Erstelle Karteikarten aus deinen Notizen." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((card) => {
              const isFlipped = flipped.has(card.id);
              return (
                <article key={card.id} className="rounded-lg border border-[#dfe6df] bg-white p-5">
                  <button
                    className="min-h-44 w-full text-left"
                    onClick={() =>
                      setFlipped((current) => {
                        const next = new Set(current);
                        if (next.has(card.id)) next.delete(card.id);
                        else next.add(card.id);
                        return next;
                      })
                    }
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">{isFlipped ? "Rückseite" : "Vorderseite"}</p>
                    <p className="mt-3 text-lg font-semibold leading-7">{isFlipped ? card.back : card.front}</p>
                  </button>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => mark(card, true)}><Check size={16} /> Gewusst</Button>
                    <Button variant="secondary" onClick={() => mark(card, false)}><X size={16} /> Nicht gewusst</Button>
                    <Button variant="ghost" className="h-10 w-10 p-0" onClick={() => setEditing(card)} aria-label="Bearbeiten"><Pencil size={16} /></Button>
                    <Button
                      variant="ghost"
                      className="h-10 w-10 p-0 text-[#b54747]"
                      onClick={async () => {
                        await deleteFlashcard(card.id);
                        await refresh();
                      }}
                      aria-label="Löschen"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <p className="mt-3 text-xs text-[#667085]">{card.knownCount} gewusst · {card.unknownCount} offen</p>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {editing ? (
        <EditCardModal
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return (
    <label className="min-w-56 text-sm font-medium">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-[#d9ded7] bg-white px-3">
        <option value="">Alle</option>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function EditCardModal({ card, onClose, onSaved }: { card: StudyCard; onClose: () => void; onSaved: () => Promise<void> }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await updateFlashcard(card.id, { front, back });
    await onSaved();
  }
  return (
    <Modal title="Karteikarte bearbeiten" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <TextArea label="Vorderseite" value={front} onChange={setFront} />
        <TextArea label="Rückseite" value={back} onChange={setBack} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button type="submit"><RotateCcw size={16} /> Speichern</Button>
        </div>
      </form>
    </Modal>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-28 w-full resize-y rounded-md border border-[#d9ded7] p-3 outline-none focus:border-[#2f6f73]" />
    </label>
  );
}
