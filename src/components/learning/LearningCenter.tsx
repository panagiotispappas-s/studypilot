"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Brain, Download, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { generateStudyContent } from "@/lib/learning/generateStudyContent";
import { useStudyData } from "@/lib/db/useStudyData";
import { downloadText } from "@/lib/utils/format";
import type {
  ExamPrepResult,
  QuizQuestion,
  SourceScope,
  SourceScopeType,
  StudyAction,
  StudyCard,
  StudyGeneration,
  StudySummaryResult,
} from "@/types/study";

const actions: Array<{ id: StudyAction; label: string }> = [
  { id: "summary", label: "Lernzettel erstellen" },
  { id: "flashcards", label: "Karteikarten erstellen" },
  { id: "quiz", label: "Quizfragen erstellen" },
  { id: "examPrep", label: "Prüfungsvorbereitung erstellen" },
  { id: "explanation", label: "Inhalt einfacher erklären" },
  { id: "terms", label: "wichtige Begriffe extrahieren" },
  { id: "questions", label: "offene Fragen erzeugen" },
];

export function LearningCenter() {
  const searchParams = useSearchParams();
  const { folders, notebooks, pages, refresh } = useStudyData();
  const [scopeType, setScopeType] = useState<SourceScopeType>((searchParams.get("scope") as SourceScopeType) || "notebook");
  const [folderId, setFolderId] = useState(searchParams.get("folderId") ?? folders[0]?.id ?? "");
  const [notebookId, setNotebookId] = useState(searchParams.get("notebookId") ?? notebooks[0]?.id ?? "");
  const [pageId, setPageId] = useState(searchParams.get("pageId") ?? pages[0]?.id ?? "");
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(3);
  const [action, setAction] = useState<StudyAction>("summary");
  const [generation, setGeneration] = useState<StudyGeneration | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const notebookPages = useMemo(() => pages.filter((page) => page.notebookId === notebookId), [notebookId, pages]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!folderId && folders[0]) setFolderId(folders[0].id);
      if (!notebookId && notebooks[0]) setNotebookId(notebooks[0].id);
      if (!pageId && pages[0]) setPageId(pages[0].id);
    });
  }, [folderId, folders, notebookId, notebooks, pageId, pages]);

  async function runGeneration() {
    setBusy(true);
    setNotice("");
    const selectedText = scopeType === "selection" ? window.getSelection()?.toString().trim() ?? "" : "";
    if (scopeType === "selection" && !selectedText) {
      setNotice("Es ist kein Text ausgewählt. Markiere Text auf der Seite oder wähle eine andere Quelle.");
      setBusy(false);
      return;
    }
    const sourceScope: SourceScope = {
      type: scopeType,
      folderId: scopeType === "folder" ? folderId : undefined,
      notebookId: scopeType === "notebook" || scopeType === "pageRange" ? notebookId : undefined,
      pageId: scopeType === "page" ? pageId : undefined,
      fromPage: scopeType === "pageRange" ? fromPage : undefined,
      toPage: scopeType === "pageRange" ? toPage : undefined,
      selectedText: scopeType === "selection" ? selectedText : undefined,
    };
    const nextGeneration = await generateStudyContent(action, sourceScope);
    setGeneration(nextGeneration);
    await refresh();
    setBusy(false);
  }

  return (
    <div>
      <PageHeader
        title="KI-Lernzentrale"
        subtitle="Lokale Vorlagen erzeugen Lernzettel, Karteikarten, Quizfragen und Prüfungsvorbereitung aus deinen gespeicherten Notizen."
      />
      <div className="grid gap-6 px-5 py-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <section className="rounded-lg border border-[#dfe6df] bg-white p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#e8f3f1] text-[#2f6f73]">
              <Brain size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Quelle und Aktion</h2>
              <p className="text-xs text-[#667085]">Bereich auswählen und Material erzeugen.</p>
            </div>
          </div>
          <div className="space-y-4">
            <Select
              label="Quelle"
              value={scopeType}
              onChange={(value) => setScopeType(value as SourceScopeType)}
              options={[
                ["folder", "ganzer Ordner"],
                ["notebook", "ganzes Notizbuch"],
                ["page", "aktuelle Seite"],
                ["pageRange", "Seitenbereich"],
                ["selection", "ausgewählter Text"],
              ]}
            />
            {scopeType === "folder" ? (
              <Select label="Ordner" value={folderId} onChange={setFolderId} options={folders.map((folder) => [folder.id, folder.name])} />
            ) : null}
            {scopeType === "notebook" || scopeType === "pageRange" ? (
              <Select label="Notizbuch" value={notebookId} onChange={setNotebookId} options={notebooks.map((notebook) => [notebook.id, notebook.title])} />
            ) : null}
            {scopeType === "page" ? (
              <Select
                label="Seite"
                value={pageId}
                onChange={setPageId}
                options={pages.map((page) => [page.id, `Seite ${page.pageNumber}`])}
              />
            ) : null}
            {scopeType === "pageRange" ? (
              <div className="grid grid-cols-2 gap-3">
                <NumberInput label="Von Seite" value={fromPage} onChange={setFromPage} max={Math.max(1, notebookPages.length)} />
                <NumberInput label="Bis Seite" value={toPage} onChange={setToPage} max={Math.max(1, notebookPages.length)} />
              </div>
            ) : null}
            <Select label="Aktion" value={action} onChange={(value) => setAction(value as StudyAction)} options={actions.map((item) => [item.id, item.label])} />
            <Button className="w-full" onClick={runGeneration} disabled={busy || notebooks.length === 0}>
              <Sparkles size={17} />
              {busy ? "Erstelle..." : "Lernmaterial erstellen"}
            </Button>
            {notice ? <p className="rounded-md bg-[#fff8d8] px-3 py-2 text-sm text-[#7a5b12]">{notice}</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-[#dfe6df] bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Ergebnis</h2>
            {generation ? (
              <Button
                variant="secondary"
                onClick={() => downloadText("lerninhalte.md", renderGenerationMarkdown(generation), "text/markdown")}
              >
                <Download size={16} />
                Markdown
              </Button>
            ) : null}
          </div>
          {!generation ? (
            <EmptyState
              title="Noch kein Lernmaterial erstellt."
              description="Wähle einen Ordner, ein Notizbuch oder einen Seitenbereich aus, um Lernmaterial zu erstellen."
            />
          ) : (
            <GenerationResult generation={generation} />
          )}
        </section>
      </div>
    </div>
  );
}

function GenerationResult({ generation }: { generation: StudyGeneration }) {
  const result = generation.result;
  if (generation.type === "summary" && isSummary(result)) {
    return (
      <div className="space-y-5">
        <Block title={result.title}>
          <p className="mb-2 text-sm text-[#667085]">Quelle: {result.sourceLabel}</p>
          <p>{result.summary}</p>
        </Block>
        <BulletBlock title="Wichtigste Punkte" items={result.keyPoints} />
        <BulletBlock title="Definitionen" items={result.definitions} />
        <BulletBlock title="Beispiele" items={result.examples} />
        <BulletBlock title="Mögliche Prüfungsfragen" items={result.examQuestions} />
      </div>
    );
  }
  if (generation.type === "examPrep" && isExamPrep(result)) {
    return (
      <div className="space-y-5">
        <BulletBlock title="Themenliste" items={result.topics} />
        <BulletBlock title="Lernplan" items={result.learningPlan} />
        <BulletBlock title="Wichtige Definitionen" items={result.importantDefinitions} />
        <BulletBlock title="Typische Fragen" items={result.typicalQuestions} />
        <BulletBlock title="Musterantworten" items={result.modelAnswers} />
        <BulletBlock title="Schwächenliste" items={result.weakSpots} />
        <Block title="Wiederholungsempfehlung"><p>{result.repetitionRecommendation}</p></Block>
      </div>
    );
  }
  if (Array.isArray(result) && result.every(isStudyCard)) {
    return <CardGrid cards={result} />;
  }
  if (Array.isArray(result) && result.every(isQuizQuestion)) {
    return <QuizList questions={result} />;
  }
  if (Array.isArray(result)) {
    return <BulletBlock title="Ausgabe" items={result.map(String)} />;
  }
  return <p className="leading-7 text-[#344054]">{String(result)}</p>;
}

function CardGrid({ cards }: { cards: StudyCard[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {cards.map((card) => (
        <article key={card.id} className="rounded-lg border border-[#dfe6df] bg-[#fbfcfa] p-4">
          <h3 className="font-medium">{card.front}</h3>
          <p className="mt-3 text-sm leading-6 text-[#475467]">{card.back}</p>
        </article>
      ))}
    </div>
  );
}

function QuizList({ questions }: { questions: QuizQuestion[] }) {
  return (
    <div className="space-y-3">
      {questions.map((question) => (
        <article key={question.id} className="rounded-lg border border-[#dfe6df] bg-[#fbfcfa] p-4">
          <h3 className="font-medium">{question.question}</h3>
          <ul className="mt-3 space-y-2 text-sm text-[#475467]">
            {question.options.map((option) => (
              <li key={option} className={option === question.correctAnswer ? "font-medium text-[#2f6f73]" : ""}>{option}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-[#667085]">{question.explanation}</p>
        </article>
      ))}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-[#2f6f73]">{title}</h3>
      <div className="leading-7 text-[#344054]">{children}</div>
    </section>
  );
}

function BulletBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Block title={title}>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </Block>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-md border border-[#d9ded7] bg-white px-3 text-sm outline-none focus:border-[#2f6f73]"
      >
        {options.length === 0 ? <option value="">Keine Inhalte vorhanden</option> : null}
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function NumberInput({ label, value, onChange, max }: { label: string; value: number; onChange: (value: number) => void; max: number }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        type="number"
        min="1"
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-10 w-full rounded-md border border-[#d9ded7] bg-white px-3 text-sm outline-none focus:border-[#2f6f73]"
      />
    </label>
  );
}

function renderGenerationMarkdown(generation: StudyGeneration): string {
  return `# StudyPilot Lernmaterial\n\n${JSON.stringify(generation.result, null, 2)}`;
}

function isSummary(value: unknown): value is StudySummaryResult {
  return Boolean(value && typeof value === "object" && "summary" in value && "keyPoints" in value);
}

function isExamPrep(value: unknown): value is ExamPrepResult {
  return Boolean(value && typeof value === "object" && "learningPlan" in value && "typicalQuestions" in value);
}

function isStudyCard(value: unknown): value is StudyCard {
  return Boolean(value && typeof value === "object" && "front" in value && "back" in value);
}

function isQuizQuestion(value: unknown): value is QuizQuestion {
  return Boolean(value && typeof value === "object" && "question" in value && "correctAnswer" in value);
}
