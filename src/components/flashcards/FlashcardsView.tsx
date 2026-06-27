"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Download, Pencil, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { createFlashcard, deleteFlashcard, updateFlashcard } from "@/lib/db/flashcards";
import { useStudyData } from "@/lib/db/useStudyData";
import { nowIso } from "@/lib/utils/date";
import { downloadText } from "@/lib/utils/format";
import type { StudyCard } from "@/types/study";

export function FlashcardsView() {
  const { folders, notebooks, flashcards, refresh } = useStudyData();
  const [folderFilter, setFolderFilter] = useState("");
  const [notebookFilter, setNotebookFilter] = useState("");
  const [editing, setEditing] = useState<StudyCard | null>(null);
  const [creating, setCreating] = useState(false);
  const [deckMode, setDeckMode] = useState<"all" | "weak" | "new">("all");
  const [sessionIndex, setSessionIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ known: 0, unsure: 0, unknown: 0 });

  const filtered = useMemo(
    () =>
      flashcards.filter((card) => {
        if (folderFilter && card.folderId !== folderFilter) return false;
        if (notebookFilter && card.notebookId !== notebookFilter) return false;
        if (deckMode === "weak" && card.unknownCount <= card.knownCount) return false;
        if (deckMode === "new" && card.knownCount + card.unknownCount > 0) return false;
        return true;
      }).sort((left, right) => {
        if (deckMode === "weak") return (right.unknownCount - right.knownCount) - (left.unknownCount - left.knownCount);
        if (deckMode === "new") return left.createdAt.localeCompare(right.createdAt);
        return (right.lastReviewedAt ?? "").localeCompare(left.lastReviewedAt ?? "");
      }),
    [deckMode, flashcards, folderFilter, notebookFilter],
  );

  const currentCard = filtered[sessionIndex] ?? filtered[0];
  const progress = filtered.length > 0 ? ((sessionIndex + 1) / filtered.length) * 100 : 0;
  const finished = filtered.length > 0 && sessionIndex >= filtered.length;

  async function mark(card: StudyCard, result: "known" | "unsure" | "unknown") {
    await updateFlashcard(card.id, {
      knownCount: card.knownCount + (result === "known" ? 1 : 0),
      unknownCount: card.unknownCount + (result === "unknown" ? 1 : 0),
      lastReviewedAt: nowIso(),
    });
    setSessionStats((current) => ({
      known: current.known + (result === "known" ? 1 : 0),
      unsure: current.unsure + (result === "unsure" ? 1 : 0),
      unknown: current.unknown + (result === "unknown" ? 1 : 0),
    }));
    setFlipped(false);
    setSessionIndex((current) => current + 1);
    await refresh();
  }

  function restartSession() {
    setSessionIndex(0);
    setFlipped(false);
    setSessionStats({ known: 0, unsure: 0, unknown: 0 });
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
        subtitle="Aktives Lernen mit Kartenstapel, Flip und Fortschritt."
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setCreating(true)}><Plus size={16} /> Karte erstellen</Button>
            {filtered.length > 0 ? <Button variant="secondary" onClick={exportCsv}><Download size={16} /> CSV</Button> : null}
          </div>
        )}
      />
      <div className="px-5 py-6 lg:px-8">
        <div className="mb-5 flex flex-wrap gap-3">
          <Filter label="Ordner" value={folderFilter} onChange={(value) => { setFolderFilter(value); restartSession(); }} options={folders.map((folder) => [folder.id, folder.name])} />
          <Filter label="Notizbuch" value={notebookFilter} onChange={(value) => { setNotebookFilter(value); restartSession(); }} options={notebooks.map((notebook) => [notebook.id, notebook.title])} />
          <Filter
            label="Stapel"
            value={deckMode}
            onChange={(value) => { setDeckMode(value as "all" | "weak" | "new"); restartSession(); }}
            options={[
              ["weak", "Schwächen"],
              ["new", "Neu"],
            ]}
          />
        </div>
        {flashcards.length > 0 ? (
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <SessionStat label="Gesamt" value={flashcards.length} hint="Karten im System" />
            <SessionStat label="Schwächen" value={flashcards.filter((card) => card.unknownCount > card.knownCount).length} hint="Priorität für Wiederholung" />
            <SessionStat label="Neu" value={flashcards.filter((card) => card.knownCount + card.unknownCount === 0).length} hint="Noch nicht gelernt" />
          </div>
        ) : null}
        {filtered.length === 0 ? (
          <EmptyState title="Noch keine Karteikarten." description="Erstelle Karteikarten aus deinen Notizen." />
        ) : finished ? (
          <section className="mx-auto max-w-2xl rounded-lg border border-[#dfe6df] bg-white p-6 text-center shadow-sm">
            <Sparkles className="mx-auto text-[#2f6f73]" size={32} />
            <h2 className="mt-4 text-2xl font-semibold">Lernsession abgeschlossen</h2>
            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <ResultStat label="Gewusst" value={sessionStats.known} tone="green" />
              <ResultStat label="Unsicher" value={sessionStats.unsure} tone="yellow" />
              <ResultStat label="Offen" value={sessionStats.unknown} tone="red" />
            </div>
            <Button className="mt-6" onClick={restartSession}>Erneut lernen</Button>
          </section>
        ) : currentCard ? (
          <section className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#667085]">Karte {sessionIndex + 1} von {filtered.length}</span>
              <span className="rounded-full bg-[#e8f3f1] px-3 py-1 text-xs font-medium text-[#2f6f73]">{currentCard.difficulty ?? "medium"}</span>
            </div>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-[#e5e9e4]">
              <div className="h-full rounded-full bg-[#2f6f73] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <button className="group block w-full [perspective:1200px]" onClick={() => setFlipped((current) => !current)}>
              <div className={`relative min-h-[340px] rounded-xl transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
                <CardFace label="Vorderseite" text={currentCard.front} />
                <CardFace label="Rückseite" text={currentCard.back} back />
              </div>
            </button>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => mark(currentCard, "known")}><Check size={16} /> Gewusst</Button>
              <Button variant="secondary" onClick={() => mark(currentCard, "unsure")}><RotateCcw size={16} /> Unsicher</Button>
              <Button variant="secondary" onClick={() => mark(currentCard, "unknown")}><X size={16} /> Nicht gewusst</Button>
              <Button variant="ghost" className="h-10 w-10 p-0" onClick={() => setEditing(currentCard)} aria-label="Bearbeiten"><Pencil size={16} /></Button>
              <Button
                variant="ghost"
                className="h-10 w-10 p-0 text-[#b54747]"
                onClick={async () => {
                  await deleteFlashcard(currentCard.id);
                  await refresh();
                  restartSession();
                }}
                aria-label="Löschen"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </section>
        ) : null}
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
      {creating ? (
        <CreateCardModal
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refresh();
            restartSession();
          }}
        />
      ) : null}
    </div>
  );
}

function SessionStat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <article className="rounded-lg border border-[#dfe6df] bg-white p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-[#667085]">{hint}</p>
    </article>
  );
}

function CardFace({ label, text, back }: { label: string; text: string; back?: boolean }) {
  return (
    <div className={`absolute inset-0 flex flex-col justify-between rounded-xl border border-[#dfe6df] bg-white p-8 text-left shadow-xl [backface-visibility:hidden] ${back ? "[transform:rotateY(180deg)] bg-[#f8fbfa]" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">{label}</p>
      <p className="text-2xl font-semibold leading-9 text-[#18202f]">{text}</p>
      <p className="text-sm text-[#667085]">Tippe auf die Karte zum Drehen.</p>
    </div>
  );
}

function ResultStat({ label, value, tone }: { label: string; value: number; tone: "green" | "yellow" | "red" }) {
  const colors = {
    green: "bg-[#e8f3f1] text-[#2f6f73]",
    yellow: "bg-[#fff8d8] text-[#7a5b12]",
    red: "bg-[#fff1f1] text-[#b54747]",
  };
  return (
    <div className={`rounded-lg p-4 ${colors[tone]}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p>{label}</p>
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

function CreateCardModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [difficulty, setDifficulty] = useState<StudyCard["difficulty"]>("medium");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!front.trim() || !back.trim()) return;
    await createFlashcard({ front, back, difficulty });
    await onSaved();
  }
  return (
    <Modal title="Karteikarte erstellen" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <TextArea label="Vorderseite" value={front} onChange={setFront} />
        <TextArea label="Rückseite" value={back} onChange={setBack} />
        <label className="block text-sm font-medium">
          Schwierigkeit
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as StudyCard["difficulty"])} className="mt-2 h-10 w-full rounded-md border border-[#d9ded7] bg-white px-3">
            <option value="easy">Leicht</option>
            <option value="medium">Mittel</option>
            <option value="hard">Schwer</option>
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
          <Button type="submit"><Plus size={16} /> Erstellen</Button>
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
