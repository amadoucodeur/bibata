import type {
  CEFRLevel,
  ConceptMastery,
  ExerciseAttempt,
  LearningProfile,
  Mission,
  MissionScore,
} from "@/types/learning";

export const LEARNING_CONSTANTS = {
  correctGain: 0.18,
  incorrectGain: 0.04,
  productionWeight: 1.2,
  reviewThreshold: 0.62,
  highPerformance: 0.86,
} as const;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

export function createEmptyMastery(conceptId: string): ConceptMastery {
  return {
    conceptId,
    exposureCount: 0,
    recognition: 0,
    recall: 0,
    contextUnderstanding: 0,
    production: 0,
    masteryScore: 0,
    confidence: 0,
    correctCount: 0,
    incorrectCount: 0,
    conversationUseCount: 0,
  };
}

export function updateConceptMastery(
  current: ConceptMastery | undefined,
  attempt: ExerciseAttempt,
): ConceptMastery {
  const mastery = current ?? createEmptyMastery(attempt.conceptIds[0]);
  const gain = attempt.correct ? LEARNING_CONSTANTS.correctGain : LEARNING_CONSTANTS.incorrectGain;
  const dimension =
    attempt.mode === "context"
      ? "contextUnderstanding"
      : attempt.mode === "recognition"
        ? "recognition"
        : attempt.mode;
  const next = { ...mastery };
  next[dimension] = clamp(next[dimension] + gain * (attempt.mode === "production" ? LEARNING_CONSTANTS.productionWeight : 1));
  next.exposureCount += 1;
  next.correctCount += attempt.correct ? 1 : 0;
  next.incorrectCount += attempt.correct ? 0 : 1;
  if (attempt.correct && attempt.source === "conversation") {
    next.conversationUseCount = (next.conversationUseCount ?? 0) + 1;
    next.assimilatedAt ??= attempt.answeredAt;
  }
  next.lastSeenAt = attempt.answeredAt;
  next.nextSuggestedExposureAt = attempt.answeredAt + (attempt.correct ? 3 : 1) * 86_400_000;
  next.confidence = clamp(0.15 + next.exposureCount * 0.09);
  next.masteryScore = clamp(
    next.recognition * 0.2 +
      next.recall * 0.3 +
      next.contextUnderstanding * 0.2 +
      next.production * 0.3,
  );
  return next;
}

export const isConceptAssimilated = (mastery: ConceptMastery | undefined) => Boolean(mastery?.assimilatedAt && mastery.conversationUseCount > 0);

export const getAssimilatedConceptIds = (mastery: Record<string, ConceptMastery>) =>
  Object.values(mastery)
    .filter(isConceptAssimilated)
    .map((item) => item.conceptId);

export function calculateMissionScore(attempts: ExerciseAttempt[]): MissionScore {
  if (attempts.length === 0) return { total: 0, concepts: 0, comprehension: 0, usage: 0 };
  const scoreFor = (modes: ExerciseAttempt["mode"][]) => {
    const relevant = attempts.filter((attempt) => modes.includes(attempt.mode));
    if (!relevant.length) return attempts.filter((attempt) => attempt.correct).length / attempts.length;
    return relevant.filter((attempt) => attempt.correct).length / relevant.length;
  };
  const concepts = scoreFor(["recognition", "recall"]);
  const comprehension = scoreFor(["context"]);
  const usage = scoreFor(["production"]);
  return {
    concepts: Math.round(concepts * 100),
    comprehension: Math.round(comprehension * 100),
    usage: Math.round(usage * 100),
    total: Math.round((concepts * 0.4 + comprehension * 0.25 + usage * 0.35) * 100),
  };
}

const levelBands: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function estimateLevel(profile: LearningProfile, recentScores: number[]) {
  if (!recentScores.length) {
    return { level: profile.estimatedLevel, confidence: profile.levelConfidence };
  }
  const average = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
  const currentIndex = Math.max(0, levelBands.indexOf(profile.estimatedLevel ?? "A1"));
  const targetIndex = average >= 86 ? currentIndex + 1 : average < 52 ? currentIndex - 1 : currentIndex;
  const smoothedIndex = Math.round(currentIndex * 0.7 + Math.max(0, Math.min(5, targetIndex)) * 0.3);
  return {
    level: levelBands[smoothedIndex],
    confidence: clamp(profile.levelConfidence + 0.12),
  };
}

export function selectOldConceptsForReview(
  mastery: Record<string, ConceptMastery>,
  limit = 3,
) {
  return Object.values(mastery)
    .filter((item) => item.exposureCount > 0 && item.masteryScore < LEARNING_CONSTANTS.reviewThreshold)
    .sort((a, b) => (a.nextSuggestedExposureAt ?? 0) - (b.nextSuggestedExposureAt ?? 0))
    .slice(0, limit)
    .map((item) => item.conceptId);
}

export function getNextMission(profile: LearningProfile, availableMissions: Mission[]) {
  return (
    availableMissions.find((mission) => !profile.completedMissionIds.includes(mission.id)) ??
    availableMissions.at(-1)
  );
}

export function getRecommendedConcepts(
  profile: LearningProfile,
  mastery: Record<string, ConceptMastery>,
  mission: Mission,
) {
  const review = selectOldConceptsForReview(mastery, 2);
  return [...new Set([...review, ...mission.conceptIds])].slice(0, 7);
}
