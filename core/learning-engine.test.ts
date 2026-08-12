import { describe, expect, test } from "bun:test";
import {
  calculateMissionScore,
  createEmptyMastery,
  estimateLevel,
  getNextMission,
  getAssimilatedConceptIds,
  isConceptAssimilated,
  selectOldConceptsForReview,
  updateConceptMastery,
} from "./learning-engine";
import { getMissionsForLevel, missions } from "../data/curriculum";
import { getMissionsForProfile } from "./personalization";
import { findConceptCandidatesInText, findConceptsUsedByLearner, getAvailableConversationReplies, getDirectConversationOpening } from "./conversation";
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

  test("assimilates a concept only after the learner uses it in conversation", () => {
    const guided = updateConceptMastery(undefined, { ...attempt(true, "production"), source: "exercise" });
    const conversation = updateConceptMastery(guided, { ...attempt(true, "production"), source: "conversation", answeredAt: 2_000 });
    expect(isConceptAssimilated(guided)).toBe(false);
    expect(isConceptAssimilated(conversation)).toBe(true);
    expect(conversation.assimilatedAt).toBe(2_000);
  });

  test("lists only concepts truly assimilated for future mission exclusion", () => {
    const guided = updateConceptMastery(undefined, { ...attempt(true, "production"), source: "exercise" });
    const conversation = updateConceptMastery(undefined, { ...attempt(true, "production"), source: "conversation", answeredAt: 2_000 });
    expect(getAssimilatedConceptIds({ guided, conversation })).toEqual(["hello"]);
  });

  test("smooths level estimation and increases confidence", () => {
    const result = estimateLevel(profile, [94, 92, 90]);
    expect(result.level).toBe("A1");
    expect(result.confidence).toBeGreaterThan(profile.levelConfidence);
  });
});

describe("game and curriculum", () => {
  test("does not suggest a conversation reply that the learner already used", () => {
    const messages = [
      { id: "opening", role: "character" as const, text: "Where would you like to go?" },
      { id: "learner-1", role: "learner" as const, text: "How long does it take by bus?" },
      { id: "reply-1", role: "character" as const, text: "About ten minutes." },
    ];
    expect(getAvailableConversationReplies(["How about walking?", "How long does it take by bus?", "Let's go!"], messages)).toEqual(["Let's go!", "How about walking?"]);
  });

  test("replaces an AI scene narration with direct character dialogue", () => {
    expect(getDirectConversationOpening("You're exploring a vibrant tech district. How do you find the exhibit?")).toBe("Hi! Let's explore this together. What would you like to do first?");
    expect(getDirectConversationOpening("Hi! Where would you like to go?")).toBe("Hi! Where would you like to go?");
  });

  test("detects lexical candidates without treating them as assimilated", () => {
    expect(findConceptCandidatesInText(
      ["How long does it take?", "take the bus"],
      "How long does it take by bus?",
    )).toEqual(["How long does it take?"]);
  });

  test("accepts only concepts semantically validated from a learner turn", () => {
    const used = findConceptsUsedByLearner([
      { id: "how-long", value: "How long does it take?" },
      { id: "take-bus", value: "take the bus" },
      { id: "sounds-good", value: "That sounds good" },
    ], [
      { id: "opening", role: "character", text: "You can take the bus." },
      { id: "learner", role: "learner", text: "How long does it take by bus?" },
      { id: "reply", role: "character", text: "About ten minutes.", validatedConcepts: ["How long does it take?"] },
    ]);
    expect(used).toEqual(["how-long"]);
  });

  test("does not assimilate an exact expression without semantic validation", () => {
    expect(findConceptsUsedByLearner(
      [{ id: "sounds-good", value: "That sounds good" }],
      [{ id: "learner", role: "learner", text: "The expression is: that sounds good." }],
    )).toEqual([]);
  });

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

  test("removes assimilated concepts from saved future missions", () => {
    const learningPlan = {
      id: "plan-test", level: "A1" as const, title: "Personal", focus: "Test", createdAt: 1, learnerSeed: "seed",
      missions: [{
        id: "plan-test-mission-1", order: 1, title: "Meet", eyebrow: "Intro", description: "Talk", interest: "music",
        conceptIds: ["hello", "nice-to-meet-you", "where-from"],
        conversation: { title: "Meet", setting: "A party", characterName: "Bibata", characterRole: "Guest", objectives: ["hello", "meet", "origin"], opening: "Hi! What is your name?" },
      }],
    };
    const filtered = getMissionsForProfile({ ...profile, learningPlan }, "A1", ["hello"]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].conceptIds).toEqual(["nice-to-meet-you", "where-from"]);
    expect(filtered[0].conversation.targetConcepts).not.toContain("Hello");
    expect(filtered[0].conversation.objectives).toEqual(["meet", "origin"]);
  });

  test("keeps acquired concepts in an explicit consolidation mission", () => {
    const learningPlan = {
      id: "plan-review", level: "A1" as const, title: "Practice", focus: "Réutiliser", createdAt: 1, learnerSeed: "seed",
      missions: [{
        id: "plan-review-mission-2", order: 2, title: "Another Meeting", eyebrow: "Consolidation", description: "Practice again", interest: "travel", kind: "consolidation" as const,
        conceptIds: ["hello", "nice-to-meet-you", "where-from"],
        conversation: { title: "Another Meeting", setting: "A station", characterName: "Bibata", characterRole: "Traveller", objectives: ["hello", "meet", "origin"], opening: "Hi! Where are you travelling today?" },
      }],
    };
    const missions = getMissionsForProfile({ ...profile, learningPlan }, "A1", ["hello", "nice-to-meet-you", "where-from"]);
    expect(missions).toHaveLength(1);
    expect(missions[0].kind).toBe("consolidation");
    expect(missions[0].conceptIds).toEqual(["hello", "nice-to-meet-you", "where-from"]);
  });

  test("removes immediate concept loops from an older saved plan", () => {
    const first = {
      id: "old-plan-mission-1", order: 1, title: "First", eyebrow: "First", description: "First", interest: "music",
      conceptIds: ["hello", "nice-to-meet-you", "where-from"],
      conversation: { title: "First", setting: "One", characterName: "Bibata", characterRole: "Guest", objectives: ["hello", "meet", "origin"], opening: "Hi! What is your name?" },
    };
    const second = {
      ...first, id: "old-plan-mission-2", order: 2, title: "Second",
      conceptIds: ["where-from", "usually", "wake-up"],
      conversation: { ...first.conversation, title: "Second", objectives: ["origin", "routine", "wake"] },
    };
    const learningPlan = { id: "old-plan", level: "A1" as const, title: "Old", focus: "Old", createdAt: 1, learnerSeed: "seed", missions: [first, second] };
    const available = getMissionsForProfile({ ...profile, learningPlan, completedMissionIds: [first.id] }, "A1");
    expect(available[1].conceptIds).toEqual(["usually", "wake-up"]);
    expect(available[1].conversation.objectives).toEqual(["routine", "wake"]);
  });
});
