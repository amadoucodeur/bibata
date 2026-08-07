export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CEFRLevel = (typeof CEFR_LEVELS)[number];

export type ConceptType =
  | "word"
  | "expression"
  | "phrasal_verb"
  | "collocation"
  | "construction"
  | "grammar";

export interface ConceptExample {
  text: string;
  translation: string;
}

export interface Concept {
  id: string;
  language: string;
  type: ConceptType;
  value: string;
  translation?: string;
  explanation?: string;
  level?: CEFRLevel;
  categories: string[];
  prerequisites?: string[];
  examples: ConceptExample[];
  imageQuery?: string;
  metadata?: Record<string, unknown>;
}

export interface ConceptMastery {
  conceptId: string;
  exposureCount: number;
  recognition: number;
  recall: number;
  contextUnderstanding: number;
  production: number;
  masteryScore: number;
  confidence: number;
  correctCount: number;
  incorrectCount: number;
  lastSeenAt?: number;
  nextSuggestedExposureAt?: number;
}

export interface LanguageAbility {
  vocabulary: number;
  grammar: number;
  comprehension: number;
  recall: number;
  production: number;
}

export interface LearningProfile {
  id: string;
  language: string;
  languageName: string;
  languageFlag: string;
  estimatedLevel?: CEFRLevel;
  levelConfidence: number;
  interests: string[];
  ability: LanguageAbility;
  currentMissionId?: string;
  completedMissionIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type ExerciseType =
  | "multiple_choice"
  | "fill_blank"
  | "sentence_builder"
  | "true_false"
  | "short_answer";

export interface Exercise {
  id: string;
  type: ExerciseType;
  concepts: string[];
  prompt: string;
  difficulty: number;
  payload: {
    choices?: string[];
    answer: string;
    translation?: string;
    tokens?: string[];
    hint?: string;
  };
  evaluationMode: "local" | "ai";
}

export interface ExerciseAttempt {
  exerciseId: string;
  conceptIds: string[];
  correct: boolean;
  response: string;
  mode: "recognition" | "recall" | "context" | "production";
  answeredAt: number;
}

export interface ConversationMessage {
  id: string;
  role: "character" | "learner";
  text: string;
}

export interface ConversationScenario {
  id: string;
  title: string;
  setting: string;
  characterName: string;
  characterRole: string;
  objectives: string[];
  targetConcepts: string[];
  suggestedReplies: string[];
}

export interface Mission {
  id: string;
  worldId: string;
  order: number;
  title: string;
  eyebrow: string;
  description: string;
  durationMinutes: number;
  conceptIds: string[];
  exercises: Exercise[];
  conversation: ConversationScenario;
}

export interface World {
  id: string;
  title: string;
  eyebrow: string;
  accent: string;
  missionIds: string[];
}

export interface Roadmap {
  language: string;
  worlds: World[];
}

export interface MissionProgress {
  missionId: string;
  status: "available" | "in_progress" | "completed";
  score?: number;
  completedAt?: number;
}

export interface MissionScore {
  total: number;
  concepts: number;
  comprehension: number;
  usage: number;
}

export interface PersistedState {
  schemaVersion: number;
  profiles: LearningProfile[];
  mastery: Record<string, ConceptMastery>;
  missionProgress: Record<string, MissionProgress>;
  activeLanguage?: string;
}
