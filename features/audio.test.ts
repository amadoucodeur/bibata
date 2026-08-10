import { describe, expect, test } from "bun:test";
import { speechLocaleFor } from "./audio";

describe("Bibata audio", () => {
  test("selects a natural locale for concept pronunciation", () => {
    expect(speechLocaleFor("en")).toBe("en-US");
    expect(speechLocaleFor("fr-CI")).toBe("fr-FR");
    expect(speechLocaleFor("sw")).toBe("sw");
  });
});
