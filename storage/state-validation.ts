import { CEFR_LEVELS, type ConceptMastery, type LanguageAbility, type LearningPlan, type LearningProfile, type MissionProgress, type PersistedState } from "@/types/learning";

const clamp = (value: unknown, min = 0, max = 1) => Math.min(max, Math.max(min, typeof value === "number" && Number.isFinite(value) ? value : 0));
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const timestamp = (value: unknown, fallback = Date.now()) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
const stringList = (value: unknown, limit: number, itemLimit: number) => Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, itemLimit)).filter(Boolean))].slice(0, limit) : [];

function ability(value: unknown): LanguageAbility {
  const item = value && typeof value === "object" ? value as Partial<LanguageAbility> : {};
  return { vocabulary: clamp(item.vocabulary), grammar: clamp(item.grammar), comprehension: clamp(item.comprehension), recall: clamp(item.recall), production: clamp(item.production) };
}

function learningPlan(value: unknown): LearningPlan | undefined {
  if (!value || typeof value !== "object" || JSON.stringify(value).length > 250_000) return undefined;
  const plan = value as Partial<LearningPlan>;
  if (!text(plan.id, 120) || !CEFR_LEVELS.includes(plan.level as LearningPlan["level"]) || !Array.isArray(plan.missions)) return undefined;
  return value as LearningPlan;
}

function profile(value: unknown): LearningProfile | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Partial<LearningProfile>;
  const language = text(item.language, 12);
  const id = text(item.id, 100);
  if (!id || !/^[a-z]{2,3}(-[A-Z]{2})?$/.test(language)) return undefined;
  const now = Date.now();
  const level = item.estimatedLevel && CEFR_LEVELS.includes(item.estimatedLevel) ? item.estimatedLevel : "A1";
  return { id, language, languageName: text(item.languageName, 60) || language.toUpperCase(), languageFlag: text(item.languageFlag, 12), estimatedLevel: level, levelConfidence: clamp(item.levelConfidence), interests: stringList(item.interests, 20, 80), ability: ability(item.ability), currentMissionId: text(item.currentMissionId, 160) || undefined, completedMissionIds: stringList(item.completedMissionIds, 2_000, 160), learningPlan: learningPlan(item.learningPlan), createdAt: timestamp(item.createdAt, now), updatedAt: timestamp(item.updatedAt, now) };
}

function mastery(conceptId: string, value: unknown): ConceptMastery {
  const item = value && typeof value === "object" ? value as Partial<ConceptMastery> : {};
  return { conceptId, exposureCount: Math.round(clamp(item.exposureCount, 0, 100_000)), recognition: clamp(item.recognition), recall: clamp(item.recall), contextUnderstanding: clamp(item.contextUnderstanding), production: clamp(item.production), masteryScore: clamp(item.masteryScore), confidence: clamp(item.confidence), correctCount: Math.round(clamp(item.correctCount, 0, 100_000)), incorrectCount: Math.round(clamp(item.incorrectCount, 0, 100_000)), lastSeenAt: item.lastSeenAt ? timestamp(item.lastSeenAt) : undefined, nextSuggestedExposureAt: item.nextSuggestedExposureAt ? timestamp(item.nextSuggestedExposureAt) : undefined };
}

function progress(missionId: string, value: unknown): MissionProgress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Partial<MissionProgress>;
  if (!item.status || !["available", "in_progress", "completed"].includes(item.status)) return undefined;
  const completedAt = item.status === "completed" ? timestamp(item.completedAt) : undefined;
  return { missionId, status: item.status, score: item.score === undefined ? undefined : Math.round(clamp(item.score, 0, 100)), completedAt };
}

export function sanitizePersistedState(value: unknown): PersistedState {
  const candidate = value && typeof value === "object" ? value as Partial<PersistedState> : {};
  const profiles = (Array.isArray(candidate.profiles) ? candidate.profiles : []).slice(0, 8).map(profile).filter((item): item is LearningProfile => Boolean(item));
  const masteryEntries = candidate.mastery && typeof candidate.mastery === "object" ? Object.entries(candidate.mastery).slice(0, 5_000) : [];
  const progressEntries = candidate.missionProgress && typeof candidate.missionProgress === "object" ? Object.entries(candidate.missionProgress).slice(0, 2_000) : [];
  return {
    schemaVersion: 1,
    profiles,
    mastery: Object.fromEntries(masteryEntries.map(([id, item]) => [text(id, 160), mastery(text(id, 160), item)]).filter(([id]) => Boolean(id))),
    missionProgress: Object.fromEntries(progressEntries.map(([id, item]) => [text(id, 160), progress(text(id, 160), item)]).filter((entry): entry is [string, MissionProgress] => Boolean(entry[0] && entry[1]))),
    activeLanguage: profiles.some((item) => item.language === candidate.activeLanguage) ? candidate.activeLanguage : profiles[0]?.language,
  };
}
