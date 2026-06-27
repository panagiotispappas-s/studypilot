"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Brain, ClipboardList, Download, Layers3, Lightbulb, MessageCircleQuestion, Sparkles, WandSparkles } from "lucide-react";
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

const actions: Array<{ id: StudyAction; label: string; description: string }> = [
  { id: "summary", label: "Lernzettel", description: "Strukturierte Zusammenfassung mit Prüfungsfragen." },
  { id: "flashcards", label: "Karteikarten", description: "Aktive Wiederholung aus Schlüsselbegriffen." },
  { id: "quiz", label: "Quizfragen", description: "Multiple Choice mit Erklärung und Schwierigkeit." },
  { id: "examPrep", label: "Prüfungsvorbereitung", description: "Plan, Themen, Musterantworten und Schwächen." },
  { id: "explanation", label: "Einfach erklären", description: "Komplexe Notizen in klare Sprache übersetzen." },
  { id: "terms", label: "Begriffe", description: "Wichtige Fachbegriffe extrahieren." },
  { id: "questions", label: "Offene Fragen", description: "Fragen zum Selbsterklären erzeugen." },
  { id: "examples", label: "Beispielaufgaben", description: "Anwendungsfragen und Übungsfälle erstellen." },
  { id: "mnemonics", label: "Eselsbrücken", description: "Merkhilfen für schwierige Begriffe bauen." },
];

export function LearningCenter() {
  const searchParams = useSearchParams();
  const { folders, notebooks, pages, generations, refresh } = useStudyData();
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
  const sourceStats = useMemo(() => {
    const scopedPages = scopeType === "folder"
      ? pages.filter((page) => notebooks.some((notebook) => notebook.folderId === folderId && notebook.id === page.notebookId))
      : scopeType === "notebook"
        ? pages.filter((page) => page.notebookId === notebookId)
        : scopeType === "pageRange"
          ? notebookPages.filter((page) => page.pageNumber >= fromPage && page.pageNumber <= toPage)
          : scopeType === "page"
            ? pages.filter((page) => page.id === pageId)
            : [];
    const elements = scopedPages.flatMap((page) => page.elements);
    return {
      pages: scopedPages.length,
      textElements: elements.filter((element) => element.type === "text" || element.type === "table").length,
      drawings: elements.filter((element) => element.type === "drawing" || element.type === "highlight").length,
    };
  }, [folderId, fromPage, notebookId, notebookPages, notebooks, pageId, pages, scopeType, toPage]);

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
            <div>
              <p className="text-sm font-medium">Aktion</p>
              <div className="mt-2 grid gap-2">
                {actions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAction(item.id)}
                    className={`rounded-lg border p-3 text-left transition ${action === item.id ? "border-[#2f6f73] bg-[#e8f3f1]" : "border-[#dfe6df] bg-white hover:border-[#aac7c1]"}`}
                  >
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#667085]">{item.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <SourceSignal stats={sourceStats} />
            <Button className="w-full" onClick={runGeneration} disabled={busy || notebooks.length === 0}>
              <Sparkles size={17} />
              {busy ? "Erstelle..." : "Lernmaterial erstellen"}
            </Button>
            {notice ? <p className="rounded-md bg-[#fff8d8] px-3 py-2 text-sm text-[#7a5b12]">{notice}</p> : null}
          </div>
          <RecentGenerations generations={generations.slice(0, 5)} />
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
            <div className="space-y-4">
              <GenerationHero generation={generation} />
              <GenerationResult generation={generation} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SourceSignal({ stats }: { stats: { pages: number; textElements: number; drawings: number } }) {
  const ready = stats.textElements > 0;
  return (
    <div className={`rounded-lg border p-3 ${ready ? "border-[#d8e9e4] bg-[#f5fbf8]" : "border-[#f4dfb8] bg-[#fffaf0]"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${ready ? "bg-[#e8f3f1] text-[#2f6f73]" : "bg-[#fff0c2] text-[#7a5b12]"}`}>
          <Layers3 size={17} />
        </span>
        <div>
          <p className="text-sm font-semibold">{ready ? "Quelle ist auswertbar" : "Quelle braucht mehr Text"}</p>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            {stats.pages} Seiten · {stats.textElements} Textbereiche · {stats.drawings} Zeichnungen. Handschrift wird ohne OCR nicht als Text ausgewertet.
          </p>
        </div>
      </div>
    </div>
  );
}

function RecentGenerations({ generations }: { generations: StudyGeneration[] }) {
  if (generations.length === 0) return null;
  return (
    <div className="mt-6 border-t border-[#edf1ec] pt-4">
      <h3 className="text-sm font-semibold">Zuletzt erstellt</h3>
      <div className="mt-3 space-y-2">
        {generations.map((generation) => (
          <article key={generation.id} className="rounded-md border border-[#edf1ec] bg-[#fbfcfa] px-3 py-2">
            <p className="text-sm font-medium">{actionTitle(generation.type)}</p>
            <p className="mt-1 text-xs text-[#667085]">{new Date(generation.createdAt).toLocaleString("de-DE")}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function GenerationHero({ generation }: { generation: StudyGeneration }) {
  const icons = {
    summary: ClipboardList,
    flashcards: Layers3,
    quiz: MessageCircleQuestion,
    examPrep: Brain,
    explanation: Lightbulb,
    terms: Sparkles,
    questions: MessageCircleQuestion,
    examples: WandSparkles,
    mnemonics: Lightbulb,
  };
  const Icon = icons[generation.type];
  return (
    <div className="rounded-xl border border-[#d8e9e4] bg-gradient-to-br from-[#f5fbf8] to-white p-5">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#2f6f73] text-white shadow-sm">
          <Icon size={22} />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2f6f73]">Lernmaterial bereit</p>
          <h3 className="mt-1 text-xl font-semibold">{actionTitle(generation.type)}</h3>
          <p className="mt-2 text-sm leading-6 text-[#667085]">
            Erzeugt aus deinen lokalen Notizen. Die Ausgabe kann exportiert, als Karteikarten gelernt oder als Quiz trainiert werden.
          </p>
        </div>
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

function actionTitle(action: StudyAction): string {
  const label = actions.find((item) => item.id === action)?.label;
  return label ?? "Lernmaterial";
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
    <section className="rounded-lg border border-[#dfe6df] bg-[#fbfcfa] p-4">
      <h3 className="mb-2 text-sm font-semibold text-[#2f6f73]">{title}</h3>
      <div className="text-sm leading-7 text-[#344054]">{children}</div>
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
