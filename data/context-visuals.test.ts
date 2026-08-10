import { describe, expect, test } from "bun:test";
import { getContextVisual } from "./context-visuals";

describe("contextual learning visuals", () => {
  test("selects a scene from the concept meaning rather than its CEFR level", () => {
    expect(getContextVisual(["city"]).src).toBe("/context/city.webp");
    expect(getContextVisual(["leadership"]).src).toBe("/context/collaboration.webp");
    expect(getContextVisual(["subtext"]).src).toBe("/context/nuance.webp");
  });
});
