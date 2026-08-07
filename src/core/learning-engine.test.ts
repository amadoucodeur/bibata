import { describe, expect, test } from "bun:test";
import {
  calculateMissionScore,
  createEmptyMastery,
  estimateLevel,
  getNextMission,
  selectOldConceptsForReview,
  updateConceptMastery,
} from "./learning-engine";
import { missions } from "../data/curriculum";
import type { ExerciseAttempt, LearningProfile } from "../types/learning";

const profile: LearningProfile = {
  id: "test-en",
  language: "en",
  languageName: "English",
  languageFlag: "🇬🇧",
  estimatedLevel: "A1",
  levelConfidence: 0.1,
  interests: ["travel"],
  ability: { vocabulary: 0.1, grammar: 0.1, comprehension: 0.1, recall: 0.1, production: 0.1 },
  completedMissionIds: [],
  createdAt: 1,
  updatedAt: 1,
};

const attempt = (correct: boolean, mode: ExerciseAttempt["mode"]): ExerciseAttempt => ({
  exerciseId: `test-${mode}`,
  conceptIds: ["hello"],
  response: "hello",
  correct,
  mode,
  answeredAt: 1_000,
});

describe("learner model", () => {
  test("strengthens the exercised skill without jumping to mastered", () => {
    const updated = updateConceptMastery(undefined, attempt(true, "recognition"));
    expect(updated.recognition).toBeGreaterThan(0);
    expect(updated.masteryScore).toBeLessThan(0.2);
    expect(updated.correctCount).toBe(1);
  });

  test("keeps weak, seen concepts available for spaced review", () => {
    const weak = { ...createEmptyMastery("hello"), exposureCount: 2, masteryScore: 0.2, nextSuggestedExposureAt: 10 };
    const strong = { ...createEmptyMastery("coffee"), exposureCount: 5, masteryScore: 0.9 };
    expect(selectOldConceptsForReview({ weak, strong })).toEqual(["hello"]);
  });

  test("smooths level estimation and increases confidence", () => {
    const result = estimateLevel(profile, [94, 92, 90]);
    expect(result.level).toBe("A1");
    expect(result.confidence).toBeGreaterThan(profile.levelConfidence);
  });
});

describe("game and curriculum", () => {
  test("weights recognition, comprehension and production in mission score", () => {
    const score = calculateMissionScore([
      attempt(true, "recognition"),
      attempt(false, "context"),
      attempt(true, "production"),
    ]);
    expect(score.concepts).toBe(100);
    expect(score.comprehension).toBe(0);
    expect(score.usage).toBe(100);
    expect(score.total).toBe(75);
  });

  test("chooses the first unfinished mission", () => {
    expect(getNextMission(profile, missions)?.id).toBe("nice-to-meet-you");
    expect(getNextMission({ ...profile, completedMissionIds: ["nice-to-meet-you"] }, missions)?.id).toBe("my-everyday-life");
  });
});
