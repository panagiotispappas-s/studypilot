"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
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

  const filtered = useMemo(
    () =>
      quizQuestions.filter((question) => {
        if (folderFilter && question.folderId !== folderFilter) return false;
        if (notebookFilter && question.notebookId !== notebookFilter) return false;
        return true;
      }),
    [folderFilter, notebookFilter, quizQuestions],
  );

  const answered = filtered.filter((question) => answers[question.id]);
  const correct = answered.filter((question) => answers[question.id] === question.correctAnswer).length;

  return (
    <div>
      <PageHeader title="Quiz" subtitle="Beantworte generierte Fragen und prüfe deine Lernstände." />
      <div className="px-5 py-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <Filter label="Ordner" value={folderFilter} onChange={setFolderFilter} options={folders.map((folder) => [folder.id, folder.name])} />
          <Filter label="Notizbuch" value={notebookFilter} onChange={setNotebookFilter} options={notebooks.map((notebook) => [notebook.id, notebook.title])} />
          {answered.length > 0 ? (
            <div className="rounded-md border border-[#dfe6df] bg-white px-4 py-2 text-sm font-medium">
              Ergebnis: {correct} von {answered.length}
            </div>
          ) : null}
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="Noch keine Quizfragen." description="Erzeuge ein Quiz aus deinen Lerninhalten." />
        ) : (
          <div className="space-y-4">
            {filtered.map((question, index) => {
              const selected = answers[question.id];
              const isCorrect = selected === question.correctAnswer;
              return (
                <article key={question.id} className="rounded-lg border border-[#dfe6df] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-[#667085]">Frage {index + 1} · {question.difficulty}</p>
                      <h2 className="mt-2 text-lg font-semibold">{question.question}</h2>
                    </div>
                    <Button
                      variant="ghost"
                      className="h-9 w-9 p-0 text-[#b54747]"
                      onClick={async () => {
                        await deleteQuizQuestion(question.id);
                        await refresh();
                      }}
                      aria-label="Quizfrage löschen"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-2">
                    {question.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                        className={`rounded-md border px-4 py-3 text-left text-sm transition ${
                          selected === option
                            ? option === question.correctAnswer
                              ? "border-[#2f6f73] bg-[#e8f3f1]"
                              : "border-[#b54747] bg-[#fff1f1]"
                            : "border-[#dfe6df] hover:bg-[#f7faf6]"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {selected ? (
                    <div className="mt-4 rounded-md bg-[#f7faf6] p-4 text-sm">
                      <p className={`flex items-center gap-2 font-medium ${isCorrect ? "text-[#2f6f73]" : "text-[#b54747]"}`}>
                        {isCorrect ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                        {isCorrect ? "Richtig" : "Nicht richtig"}
                      </p>
                      <p className="mt-2 text-[#475467]">{question.explanation}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
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
