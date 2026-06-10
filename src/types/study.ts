export type ID = string;

export type SourceScopeType =
  | "folder"
  | "notebook"
  | "page"
  | "pageRange"
  | "selection";

export type StudyAction =
  | "summary"
  | "flashcards"
  | "quiz"
  | "examPrep"
  | "explanation"
  | "terms"
  | "questions";

export interface Timestamped {
  createdAt: string;
  updatedAt: string;
}

export interface StudyFolder extends Timestamped {
  id: ID;
  userId?: ID;
  ownerId?: ID;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface Notebook extends Timestamped {
  id: ID;
  userId?: ID;
  ownerId?: ID;
  folderId: ID;
  title: string;
  description?: string;
  coverColor?: string;
  favorite: boolean;
  lastOpenedAt?: string;
}

export type PageBackgroundType = "blank" | "lined" | "grid" | "dotted" | "pdf";

export interface NotePage extends Timestamped {
  id: ID;
  userId?: ID;
  ownerId?: ID;
  notebookId: ID;
  title?: string;
  pageNumber: number;
  backgroundType: PageBackgroundType;
  backgroundPdf?: PdfData;
  templateId?: string;
  paperFormat?: "A4" | "A5" | "Letter" | "iPad";
  orientation?: "portrait" | "landscape";
}

export type PageElementType =
  | "text"
  | "drawing"
  | "highlight"
  | "shape"
  | "table"
  | "image"
  | "pdf"
  | "comment"
  | "tape";

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: ID;
  points: Point[];
  color: string;
  width: number;
  tool: "pen" | "marker" | "eraser";
}

export interface DrawingData {
  strokes: Stroke[];
}

export interface ShapeData {
  shapeType: "rectangle" | "circle" | "line" | "arrow";
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
}

export interface TableData {
  rows: number;
  columns: number;
  cells: string[][];
}

export interface CommentData {
  text: string;
  resolved: boolean;
}

export interface TapeData {
  color: string;
  revealed: boolean;
}

export interface TextData {
  text: string;
  fontSize: number;
  color: string;
}

export interface ImageData {
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface PdfData {
  name: string;
  dataUrl: string;
  pageCount: number;
}

export type PageElementData =
  | DrawingData
  | ShapeData
  | TableData
  | CommentData
  | TextData
  | ImageData
  | PdfData
  | TapeData;

export interface PageElement extends Timestamped {
  id: ID;
  userId?: ID;
  ownerId?: ID;
  pageId: ID;
  type: PageElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  zIndex: number;
  data: PageElementData;
}

export interface StudyCard extends Timestamped {
  id: ID;
  userId?: ID;
  ownerId?: ID;
  folderId?: ID;
  notebookId?: ID;
  pageId?: ID;
  front: string;
  back: string;
  sourceText?: string;
  difficulty?: "easy" | "medium" | "hard";
  lastReviewedAt?: string;
  knownCount: number;
  unknownCount: number;
}

export interface QuizQuestion {
  id: ID;
  userId?: ID;
  ownerId?: ID;
  folderId?: ID;
  notebookId?: ID;
  pageId?: ID;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  createdAt: string;
}

export interface SourceScope {
  type: SourceScopeType;
  folderId?: ID;
  notebookId?: ID;
  pageId?: ID;
  fromPage?: number;
  toPage?: number;
  selectedText?: string;
}

export interface StudySummaryResult {
  title: string;
  sourceLabel: string;
  summary: string;
  keyPoints: string[];
  definitions: string[];
  examples: string[];
  examQuestions: string[];
}

export interface ExamPrepResult {
  sourceLabel: string;
  topics: string[];
  learningPlan: string[];
  importantDefinitions: string[];
  typicalQuestions: string[];
  modelAnswers: string[];
  weakSpots: string[];
  repetitionRecommendation: string;
}

export type StudyGenerationResult =
  | StudySummaryResult
  | StudyCard[]
  | QuizQuestion[]
  | ExamPrepResult
  | string[]
  | string;

export interface StudyGeneration {
  id: ID;
  userId?: ID;
  ownerId?: ID;
  type: StudyAction;
  sourceScope: SourceScope;
  sourceIds: ID[];
  result: StudyGenerationResult;
  createdAt: string;
}

export interface PageWithElements extends NotePage {
  elements: PageElement[];
}

export interface SearchResult {
  id: ID;
  type: "folder" | "notebook" | "page" | "flashcard" | "quiz";
  title: string;
  subtitle?: string;
  href?: string;
}

export type EducationType = "Schüler" | "Student" | "Azubi" | "Weiterbildung";

export interface StudyProfile extends Timestamped {
  id: ID;
  userId: ID;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  educationType?: EducationType;
  institution?: string;
}

export interface StudyAccount extends Timestamped {
  id: ID;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  profileId: ID;
}

export interface StudyAuthSession {
  id: ID;
  userId: ID;
  profileId: ID;
  createdAt: string;
}

export interface ImportedPdf extends Timestamped {
  id: ID;
  userId?: ID;
  pageId?: ID;
  notebookId?: ID;
  name: string;
  dataUrl: string;
  pageCount: number;
  size: number;
  mimeType: string;
}

export interface StudyComment extends Timestamped {
  id: ID;
  userId?: ID;
  pageId: ID;
  elementId?: ID;
  text: string;
  resolved: boolean;
  x?: number;
  y?: number;
}
