"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Sparkles, Trash2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { deleteQuizQuestion } from "@/lib/db/quiz";
import { useStudyData } from "@/lib/db/useStudyData";

export function QuizView() {
  const { folders, notebooks, quizQuestions, refresh } = useStudyData();
  const [folderFilter, setFolderFilter] = useState("");
  const [notebookFilter, setNotebookFilter] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);

  const filtered = useMemo(
    () =>
      quizQuestions.filter((question) => {
        if (folderFilter && question.folderId !== folderFilter) return false;
        if (notebookFilter && question.notebookId !== notebookFilter) return false;
        return true;
      }),
    [folderFilter, notebookFilter, quizQuestions],
  );

  const current = filtered[index];
  const answered = filtered.filter((question) => answers[question.id]);
  const correct = answered.filter((question) => answers[question.id] === question.correctAnswer).length;
  const finished = filtered.length > 0 && index >= filtered.length;
  const selected = current ? answers[current.id] : undefined;
  const progress = filtered.length > 0 ? ((Math.min(index + 1, filtered.length)) / filtered.length) * 100 : 0;

  function restart() {
    setAnswers({});
    setIndex(0);
    setStarted(true);
  }

  return (
    <div>
      <PageHeader title="Quiz" subtitle="Prüfungstraining mit Fortschritt, Erklärung und Ergebnis." />
      <div className="px-5 py-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <Filter label="Ordner" value={folderFilter} onChange={(value) => { setFolderFilter(value); setStarted(false); setIndex(0); }} options={folders.map((folder) => [folder.id, folder.name])} />
          <Filter label="Notizbuch" value={notebookFilter} onChange={(value) => { setNotebookFilter(value); setStarted(false); setIndex(0); }} options={notebooks.map((notebook) => [notebook.id, notebook.title])} />
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="Noch keine Quizfragen." description="Erzeuge ein Quiz aus deinen Lerninhalten." />
        ) : !started ? (
          <section className="mx-auto max-w-2xl rounded-xl border border-[#dfe6df] bg-white p-8 text-center shadow-sm">
            <Sparkles className="mx-auto text-[#2f6f73]" size={34} />
            <h2 className="mt-4 text-2xl font-semibold">Quizsession starten</h2>
            <p className="mt-2 text-sm leading-6 text-[#667085]">{filtered.length} Fragen warten auf dich. Nach jeder Antwort erhältst du eine Erklärung.</p>
            <Button className="mt-6" onClick={() => setStarted(true)}>Starten</Button>
          </section>
        ) : finished ? (
          <section className="mx-auto max-w-2xl rounded-xl border border-[#dfe6df] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border-8 border-[#e8f3f1] text-3xl font-semibold text-[#2f6f73]">
              {correct}/{filtered.length}
            </div>
            <h2 className="mt-5 text-2xl font-semibold">Ergebnis</h2>
            <p className="mt-2 text-sm text-[#667085]">
              {correct === filtered.length ? "Sehr stark. Wiederhole die Karten später noch einmal." : "Wiederhole die Fragen, bei denen du unsicher warst."}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Button onClick={restart}><RotateCcw size={16} /> Erneut starten</Button>
            </div>
          </section>
        ) : current ? (
          <section className="mx-auto max-w-3xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-[#667085]">Frage {index + 1} von {filtered.length}</span>
              <span className="rounded-full bg-[#eef3ee] px-3 py-1 text-xs font-medium text-[#475467]">{current.difficulty}</span>
            </div>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-[#e5e9e4]">
              <div className="h-full rounded-full bg-[#2f6f73] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <article className="rounded-xl border border-[#dfe6df] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-xl font-semibold leading-8">{current.question}</h2>
                <Button
                  variant="ghost"
                  className="h-9 w-9 p-0 text-[#b54747]"
                  onClick={async () => {
                    await deleteQuizQuestion(current.id);
                    await refresh();
                  }}
                  aria-label="Quizfrage löschen"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <div className="mt-5 grid gap-3">
                {current.options.map((option) => {
                  const isSelected = selected === option;
                  const isCorrect = option === current.correctAnswer;
                  return (
                    <button
                      key={option}
                      disabled={Boolean(selected)}
                      onClick={() => setAnswers((values) => ({ ...values, [current.id]: option }))}
                      className={`rounded-lg border px-4 py-4 text-left text-sm transition ${
                        selected
                          ? isCorrect
                            ? "border-[#2f6f73] bg-[#e8f3f1] text-[#1f5f61]"
                            : isSelected
                              ? "border-[#b54747] bg-[#fff1f1] text-[#b54747]"
                              : "border-[#dfe6df] bg-white text-[#667085]"
                          : "border-[#dfe6df] bg-white hover:-translate-y-0.5 hover:border-[#aac7c1] hover:shadow-sm"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {selected ? (
                <div className="mt-5 rounded-lg bg-[#f7faf6] p-4 text-sm">
                  <p className={`flex items-center gap-2 font-medium ${selected === current.correctAnswer ? "text-[#2f6f73]" : "text-[#b54747]"}`}>
                    {selected === current.correctAnswer ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    {selected === current.correctAnswer ? "Richtig" : "Nicht richtig"}
                  </p>
                  <p className="mt-2 leading-6 text-[#475467]">{current.explanation}</p>
                  <Button className="mt-4" onClick={() => setIndex((value) => value + 1)}>
                    {index + 1 === filtered.length ? "Ergebnis anzeigen" : "Nächste Frage"}
                  </Button>
                </div>
              ) : null}
            </article>
          </section>
        ) : null}
      </div>
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
