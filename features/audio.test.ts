import { describe, expect, test } from "bun:test";
import { selectSpeechVoice, speechLocaleFor } from "./audio";

const voice = (name: string, lang: string, isDefault = false) => ({ name, lang, default: isDefault, localService: true, voiceURI: name } as SpeechSynthesisVoice);

describe("Bibata audio", () => {
  test("selects a natural locale for concept pronunciation", () => {
    expect(speechLocaleFor("en")).toBe("en-US");
    expect(speechLocaleFor("fr-CI")).toBe("fr-FR");
    expect(speechLocaleFor("sw")).toBe("sw");
  });

  test("prefers a natural target-language voice over the first installed voice", () => {
    const voices = [voice("Fred", "en-US", true), voice("Google US English", "en-US")];
    expect(selectSpeechVoice(voices, "en")?.name).toBe("Google US English");
  });

  test("never selects a novelty voice for learning", () => {
    const voices = [voice("Whisper", "en-US", true), voice("Daniel", "en-GB")];
    expect(selectSpeechVoice(voices, "en")?.name).toBe("Daniel");
  });

  test("does not use a voice from another language", () => {
    const voices = [voice("Google français", "fr-FR"), voice("Samantha", "en-US")];
    expect(selectSpeechVoice(voices, "en")?.name).toBe("Samantha");
  });
});
