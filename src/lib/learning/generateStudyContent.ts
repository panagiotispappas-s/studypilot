import { db } from "@/lib/db/indexeddb";
import { createId } from "@/lib/editor/elementUtils";
import { extractTextFromScope } from "@/lib/learning/extractTextFromScope";
import { nowIso } from "@/lib/utils/date";
import { normalizeText } from "@/lib/utils/format";
import type {
  ExamPrepResult,
  QuizQuestion,
  SourceScope,
  StudyAction,
  StudyCard,
  StudyGeneration,
  StudyGenerationResult,
  StudySummaryResult,
} from "@/types/study";

export async function generateStudyContent(
  action: StudyAction,
  scope: SourceScope,
): Promise<StudyGeneration> {
  const extracted = await extractTextFromScope(scope);
  const sentences = splitSentences(extracted.text);
  const keywords = extractKeywords(extracted.text);
  const formulas = extractFormulaLikeParts(extracted.text);
  const timestamp = nowIso();
  const result = buildResult(action, scope, extracted.text, sentences, keywords, formulas, timestamp);
  const generation: StudyGeneration = {
    id: createId("generation"),
    type: action,
    sourceScope: scope,
    sourceIds: extracted.sourceIds,
    result,
    createdAt: timestamp,
  };

  await db.generations.add(generation);
  if (action === "flashcards" && Array.isArray(result)) {
    const cards = result.filter(isStudyCard);
    if (cards.length > 0) await db.flashcards.bulkPut(cards);
  }
  if (action === "quiz" && Array.isArray(result)) {
    const questions = result.filter(isQuizQuestion);
    if (questions.length > 0) await db.quizQuestions.bulkPut(questions);
  }
  return generation;
}

function buildResult(
  action: StudyAction,
  scope: SourceScope,
  text: string,
  sentences: string[],
  keywords: string[],
  formulas: string[],
  timestamp: string,
): StudyGenerationResult {
  const fallback = "Es wurden noch keine auswertbaren Inhalte gefunden.";
  const tooShort = "Der ausgewählte Bereich enthält noch zu wenig Text. Füge mehr Inhalte hinzu oder wähle einen größeren Bereich.";
  const sourceLabel = describeScope(scope);
  if (!text.trim()) {
    if (action === "summary") {
      return {
        title: "Lernzettel",
        sourceLabel,
        summary: fallback,
        keyPoints: [],
        definitions: [],
        examples: [],
        examQuestions: [],
      } satisfies StudySummaryResult;
    }
    if (action === "examPrep") {
      return {
        sourceLabel,
        topics: [],
        learningPlan: [fallback],
        importantDefinitions: [],
        typicalQuestions: [],
        modelAnswers: [],
        weakSpots: ["Noch keine auswertbaren Textinhalte vorhanden."],
        repetitionRecommendation: "Ergänze zuerst Textnotizen, Tabellen oder Kommentare und starte die Erstellung erneut.",
      } satisfies ExamPrepResult;
    }
    return [fallback];
  }
  if (text.trim().length < 80 && action !== "terms") {
    if (action === "summary") {
      return {
        title: "Lernzettel",
        sourceLabel,
        summary: tooShort,
        keyPoints: sentences,
        definitions: keywords.map((keyword) => `${capitalize(keyword)}: Begriff aus dem ausgewählten Inhalt.`),
        examples: [],
        examQuestions: [],
      } satisfies StudySummaryResult;
    }
    return [tooShort];
  }

  if (action === "summary") {
    return {
      title: keywords[0] ? `Lernzettel: ${capitalize(keywords[0])}` : "Lernzettel",
      sourceLabel,
      summary: sentences.slice(0, 3).join(" "),
      keyPoints: [
        ...sentences.slice(0, 5),
        ...formulas.slice(0, 2).map((formula) => `Merke dir die Formel oder Zahl: ${formula}`),
      ],
      definitions: keywords.slice(0, 6).map((keyword) => `${capitalize(keyword)}: zentraler Begriff, den du erklären und anwenden können solltest.`),
      examples: sentences.filter((sentence) => /zum beispiel|beispiel|etwa|wenn/i.test(sentence)).slice(0, 4),
      examQuestions: keywords.slice(0, 5).map((keyword) => `Erkläre ${keyword} mit eigenen Worten.`),
    } satisfies StudySummaryResult;
  }

  if (action === "flashcards") {
    return keywords.slice(0, 10).map((keyword, index) => ({
      id: createId("card"),
      folderId: scope.folderId,
      notebookId: scope.notebookId,
      pageId: scope.pageId,
      front: `Was bedeutet ${keyword}?`,
      back: findSentenceForKeyword(sentences, keyword) ?? `${capitalize(keyword)} ist ein wichtiger Begriff aus deinen Notizen. Formuliere dazu eine eigene Erklärung und ein kurzes Beispiel.`,
      sourceText: text.slice(0, 280),
      difficulty: index < 3 ? "easy" : index < 7 ? "medium" : "hard",
      createdAt: timestamp,
      updatedAt: timestamp,
      knownCount: 0,
      unknownCount: 0,
    })) satisfies StudyCard[];
  }

  if (action === "quiz") {
    return keywords.slice(0, 8).map((keyword, index) => {
      const correctAnswer = findSentenceForKeyword(sentences, keyword) ?? `${capitalize(keyword)} kommt in deinen Notizen vor und sollte fachlich erklärt werden können.`;
      const distractors = keywords
        .filter((candidate) => candidate !== keyword)
        .slice(0, 3)
        .map((candidate) => `${capitalize(candidate)} gehört zu einem anderen Schwerpunkt deiner Notizen.`);
      return {
        id: createId("quiz"),
        folderId: scope.folderId,
        notebookId: scope.notebookId,
        pageId: scope.pageId,
        question: `Welche Aussage passt am besten zu ${keyword}?`,
        options: shuffle([correctAnswer, ...distractors]).slice(0, 4),
        correctAnswer,
        explanation: `Die richtige Antwort greift den Satz oder Zusammenhang auf, in dem ${keyword} in deinen Notizen vorkommt.`,
        difficulty: index < 3 ? "easy" : index < 6 ? "medium" : "hard",
        createdAt: timestamp,
      } satisfies QuizQuestion;
    });
  }

  if (action === "examPrep") {
    return {
      topics: keywords.slice(0, 8).map(capitalize),
      sourceLabel,
      learningPlan: [
        "Tag 1: Grundlagen und Begriffe wiederholen.",
        "Tag 2: Zusammenhänge erklären und offene Fragen klären.",
        "Tag 3: Karteikarten abfragen und Quiz bearbeiten.",
        "Tag 4: typische Prüfungsfragen schriftlich beantworten.",
      ],
      importantDefinitions: keywords.slice(0, 6).map((keyword) => `${capitalize(keyword)}: prüfungsrelevanter Begriff, der mit Definition, Beispiel und Anwendung sitzen sollte.`),
      typicalQuestions: keywords.slice(0, 6).map((keyword) => `Wie würdest du ${keyword} in einer Prüfung erklären?`),
      modelAnswers: [
        ...sentences.slice(0, 4),
        ...formulas.slice(0, 2).map((formula) => `Bei ${formula} solltest du Bedeutung, Einheiten und Anwendung benennen.`),
      ],
      weakSpots: keywords.length < 4 ? ["Der Text enthält noch wenige klare Schlüsselbegriffe."] : [],
      repetitionRecommendation: "Wiederhole zuerst die Begriffe, beantworte danach die typischen Fragen schriftlich und prüfe anschließend die Karteikarten.",
    } satisfies ExamPrepResult;
  }

  if (action === "explanation") {
    return `Einfach erklärt: ${sentences.slice(0, 4).join(" ")}`;
  }

  if (action === "terms") {
    return keywords.slice(0, 16).map(capitalize);
  }

  if (action === "examples") {
    const explicitExamples = sentences.filter((sentence) => /zum beispiel|beispiel|etwa|wenn|anwendung|fall/i.test(sentence));
    return [
      ...explicitExamples.slice(0, 5),
      ...keywords.slice(0, 6).map((keyword) => `Beispielaufgabe zu ${keyword}: Beschreibe eine Situation, in der ${keyword} angewendet wird, und löse sie Schritt für Schritt.`),
    ].slice(0, 8);
  }

  if (action === "mnemonics") {
    return keywords.slice(0, 10).map((keyword, index) => {
      const hook = keyword.length > 7 ? keyword.slice(0, 4).toUpperCase() : capitalize(keyword);
      const sentence = findSentenceForKeyword(sentences, keyword);
      return `${hook}: Merke dir ${keyword} über ${sentence ? `den Zusammenhang „${sentence.slice(0, 110)}“` : "eine eigene kurze Bildgeschichte"}. Wiederhole die Eselsbrücke laut und schreibe ein Mini-Beispiel dazu. ${index < 3 ? "Priorität hoch." : "Priorität normal."}`;
    });
  }

  return keywords.slice(0, 8).map((keyword) => `Welche Rolle spielt ${keyword} im Thema?`);
}

function splitSentences(text: string): string[] {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12)
    .slice(0, 30);
}

function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    "aber",
    "alle",
    "auch",
    "das",
    "den",
    "der",
    "die",
    "ein",
    "eine",
    "einen",
    "für",
    "ist",
    "mit",
    "oder",
    "und",
    "werden",
    "wird",
    "von",
    "warum",
    "wenn",
    "wie",
    "wird",
    "zu",
    "zur",
    "zum",
    "the",
    "and",
    "with",
  ]);
  const counts = new Map<string, number>();
  normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopwords.has(word))
    .forEach((word) => counts.set(word, (counts.get(word) ?? 0) + 1));
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "de"))
    .map(([word]) => word)
    .slice(0, 20);
}

function extractFormulaLikeParts(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((part) => /[=<>+\-*/%]|\d/.test(part) && part.length > 1)
    .slice(0, 8);
}

function findSentenceForKeyword(sentences: string[], keyword: string): string | undefined {
  return sentences.find((sentence) => sentence.toLowerCase().includes(keyword.toLowerCase()));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function describeScope(scope: SourceScope): string {
  if (scope.type === "folder") return "Ganzer Ordner";
  if (scope.type === "notebook") return "Ganzes Notizbuch";
  if (scope.type === "page") return "Aktuelle Seite";
  if (scope.type === "pageRange") return `Seiten ${scope.fromPage ?? 1} bis ${scope.toPage ?? scope.fromPage ?? 1}`;
  if (scope.type === "selection") return "Ausgewählter Text";
  return "Ausgewählte Inhalte";
}

function shuffle<T>(values: T[]): T[] {
  return values
    .map((value) => ({ value, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ value }) => value);
}

function isStudyCard(value: unknown): value is StudyCard {
  return Boolean(value && typeof value === "object" && "front" in value && "back" in value);
}

function isQuizQuestion(value: unknown): value is QuizQuestion {
  return Boolean(value && typeof value === "object" && "question" in value && "correctAnswer" in value);
}
