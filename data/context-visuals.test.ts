import { describe, expect, test } from "bun:test";
import { getContextVisual } from "./context-visuals";

describe("contextual learning visuals", () => {
  test("selects a scene from the concept meaning rather than its CEFR level", () => {
    expect(getContextVisual(["city"]).src).toBe("/context/city.webp");
    expect(getContextVisual(["leadership"]).src).toBe("/context/collaboration.webp");
    expect(getContextVisual(["subtext"]).src).toBe("/context/nuance.webp");
  });

  test("combines category, mission context and interest instead of using one generic fallback", () => {
    expect(getContextVisual({ categories: ["requests"], interest: "food", missionId: "cafe-1", title: "Order a drink" }).src).toBe("/context/cafe.webp");
    expect(getContextVisual({ categories: ["plans"], interest: "music", missionId: "concert-1", setting: "Choose an evening together" }).src).toBe("/context/plans.webp");
    expect(getContextVisual({ categories: ["analysis"], interest: "science", missionId: "evidence-1" }).src).toBe("/context/analysis.webp");
  });
});
