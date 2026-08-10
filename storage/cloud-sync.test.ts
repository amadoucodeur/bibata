import { describe, expect, test } from "bun:test";
import { buildLearningSyncDelta, mergeLearningStates } from "./cloud-sync";
import type { PersistedState } from "@/types/learning";

const profile = (updatedAt: number, completedMissionIds: string[]) => ({ id: "local-en", language: "en", languageName: "English", languageFlag: "🇬🇧", estimatedLevel: "B1" as const, levelConfidence: 1, interests: ["science"], ability: { vocabulary: .3, grammar: .3, comprehension: .3, recall: .3, production: .3 }, completedMissionIds, createdAt: 1, updatedAt });

describe("learning cloud merge", () => {
  test("keeps the newest profile while preserving completed missions from both devices", () => {
    const local: PersistedState = { schemaVersion: 1, profiles: [profile(20, ["one"])], mastery: {}, missionProgress: {}, activeLanguage: "en" };
    const remote: PersistedState = { schemaVersion: 1, profiles: [profile(10, ["two"])], mastery: {}, missionProgress: {} };
    const merged = mergeLearningStates(local, remote);
    expect(merged.profiles[0].updatedAt).toBe(20);
    expect(merged.profiles[0].completedMissionIds.sort()).toEqual(["one", "two"]);
  });

  test("never replaces a completed mission with an unfinished state", () => {
    const local: PersistedState = { schemaVersion: 1, profiles: [], mastery: {}, missionProgress: { mission: { missionId: "mission", status: "completed", completedAt: 20 } } };
    const remote: PersistedState = { schemaVersion: 1, profiles: [], mastery: {}, missionProgress: { mission: { missionId: "mission", status: "in_progress" } } };
    expect(mergeLearningStates(local, remote).missionProgress.mission.status).toBe("completed");
  });

  test("uploads only mastery and progress records that changed", () => {
    const previous: PersistedState = {
      schemaVersion: 1,
      profiles: [profile(10, [])],
      missionProgress: { one: { missionId: "one", status: "completed", completedAt: 10 } },
      mastery: { known: { conceptId: "known", exposureCount: 1, recognition: .5, recall: .5, contextUnderstanding: .5, production: .5, masteryScore: .5, confidence: .5, correctCount: 1, incorrectCount: 0, conversationUseCount: 0 } },
    };
    const current: PersistedState = {
      ...previous,
      missionProgress: { ...previous.missionProgress, two: { missionId: "two", status: "in_progress" } },
      mastery: { ...previous.mastery, new: { conceptId: "new", exposureCount: 1, recognition: .2, recall: .2, contextUnderstanding: .2, production: .2, masteryScore: .2, confidence: .2, correctCount: 1, incorrectCount: 0, conversationUseCount: 0 } },
    };
    const delta = buildLearningSyncDelta(current, previous);
    expect(Object.keys(delta.missionProgress)).toEqual(["two"]);
    expect(Object.keys(delta.mastery)).toEqual(["new"]);
  });
});
