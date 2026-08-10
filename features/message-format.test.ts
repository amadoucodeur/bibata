import { describe, expect, test } from "bun:test";
import { parseMessageText } from "./message-format";

describe("conversation message formatting", () => {
  test("turns paired markdown markers into bold text parts", () => {
    expect(parseMessageText("I **used to** download music.")).toEqual([
      { text: "I ", bold: false },
      { text: "used to", bold: true },
      { text: " download music.", bold: false },
    ]);
  });

  test("does not expose incomplete markdown markers", () => {
    expect(parseMessageText("This **marker is incomplete")).toEqual([
      { text: "This marker is incomplete", bold: false },
    ]);
  });
});
