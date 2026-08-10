import { describe, expect, test } from "bun:test";
import {
  calculateMissionScore,
  createEmptyMastery,
  estimateLevel,
  getNextMission,
  selectOldConceptsForReview,
  updateConceptMastery,
} from "./learning-engine";
import { getMissionsForLevel, missions } from "../data/curriculum";
import { getMissionsForProfile } from "./personalization";
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

  test("starts every CEFR level with a distinct learning path", () => {
    const levels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
    const firstMissions = levels.map((level) => getMissionsForLevel(level)[0]);

    expect(new Set(firstMissions.map((mission) => mission.id)).size).toBe(levels.length);
    expect(new Set(firstMissions.map((mission) => mission.title)).size).toBe(levels.length);
    expect(new Set(firstMissions.flatMap((mission) => mission.conceptIds)).size).toBe(firstMissions.length * 3);
  });

  test("raises exercise difficulty and skips beginner introductions at advanced levels", () => {
    const a1 = getMissionsForLevel("A1")[0];
    const c2 = getMissionsForLevel("C2")[0];

    expect(c2.exercises[0].difficulty).toBeGreaterThan(a1.exercises[0].difficulty);
    expect(c2.conceptIds).not.toContain("hello");
    expect(c2.conversation.opening).not.toContain("What's your name");
  });

  test("does not silently replace a failed personal plan with static missions", () => {
    expect(getMissionsForProfile(profile, "A1")).toEqual([]);
    expect(getMissionsForProfile(undefined, "A1")).toHaveLength(2);
  });
});
