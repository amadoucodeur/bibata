"use client";

import { useCallback, useSyncExternalStore } from "react";

export type UISound = "transition" | "success" | "error" | "message" | "send" | "complete";

const SOUND_KEY = "bibata-sound-enabled";
const SOUND_EVENT = "bibata-sound-change";
let context: AudioContext | undefined;
let speechRequestId = 0;

const NATURAL_VOICE_NAMES: Record<string, string[]> = {
  en: ["google us english", "google uk english female", "samantha", "ava", "allison", "aria", "jenny", "joanna", "daniel", "karen", "moira", "tessa", "victoria"],
  fr: ["google français", "audrey", "aurelie", "amélie", "thomas", "marie"],
  es: ["google español", "monica", "paulina", "jorge"],
  de: ["google deutsch", "anna", "petra", "markus"],
  it: ["google italiano", "alice", "federica", "luca"],
  pt: ["google português", "luciana", "joana", "felipe"],
  ar: ["google العربية", "maged", "tarik"],
};

const NOVELTY_VOICE_PATTERN = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|princess|superstar|trinoids|whisper|wobble|zarvox/i;

function storageEnabled() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "false";
  } catch {
    return true;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(SOUND_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SOUND_EVENT, callback);
  };
}

function audioContext() {
  if (context) return context;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return undefined;
  context = new AudioContextClass();
  return context;
}

function tone(audio: AudioContext, frequency: number, offset: number, duration: number, volume: number, type: OscillatorType = "sine") {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const start = audio.currentTime + offset;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function schedule(audio: AudioContext, sound: UISound) {
  if (sound === "success") {
    tone(audio, 523.25, 0, .13, .055);
    tone(audio, 659.25, .095, .2, .05);
  } else if (sound === "error") {
    tone(audio, 246.94, 0, .14, .035, "triangle");
    tone(audio, 196, .1, .19, .03, "triangle");
  } else if (sound === "complete") {
    tone(audio, 523.25, 0, .14, .055);
    tone(audio, 659.25, .1, .16, .052);
    tone(audio, 783.99, .21, .3, .05);
  } else if (sound === "message") {
    tone(audio, 698.46, 0, .11, .028);
    tone(audio, 880, .07, .15, .024);
  } else if (sound === "send") {
    tone(audio, 440, 0, .09, .024, "triangle");
  } else {
    tone(audio, 392, 0, .11, .032);
    tone(audio, 523.25, .07, .16, .026);
  }
}

export function playUISound(sound: UISound) {
  if (typeof window === "undefined" || !storageEnabled()) return;
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().then(() => schedule(audio, sound)).catch(() => undefined);
  else schedule(audio, sound);
}

export function speechLocaleFor(language: string) {
  const locales: Record<string, string> = { en: "en-US", fr: "fr-FR", es: "es-ES", de: "de-DE", it: "it-IT", pt: "pt-BR", ar: "ar-SA" };
  return locales[language.toLowerCase().split("-")[0]] ?? language;
}

export function selectSpeechVoice(voices: SpeechSynthesisVoice[], language: string) {
  const locale = speechLocaleFor(language).toLowerCase();
  const languageCode = locale.split("-")[0];
  const preferredNames = NATURAL_VOICE_NAMES[languageCode] ?? [];

  return voices
    .filter((voice) => voice.lang.toLowerCase().split("-")[0] === languageCode && !NOVELTY_VOICE_PATTERN.test(voice.name))
    .map((voice, index) => {
      const name = voice.name.toLowerCase();
      const preferenceIndex = preferredNames.findIndex((preferred) => name.includes(preferred));
      const score =
        (voice.lang.toLowerCase() === locale ? 50 : 20)
        + (preferenceIndex >= 0 ? 40 - preferenceIndex : 0)
        + (/premium|enhanced|natural|neural|siri|google/i.test(name) ? 24 : 0)
        + (voice.default ? 4 : 0);
      return { voice, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.voice;
}

function speakWithLoadedVoices(text: string, language: string, voices: SpeechSynthesisVoice[]) {
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = selectSpeechVoice(voices, language);
  utterance.lang = voice?.lang ?? speechLocaleFor(language);
  utterance.rate = .94;
  utterance.pitch = .98;
  utterance.volume = 1;
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

export function speakText(text: string, language: string) {
  if (typeof window === "undefined" || !storageEnabled() || !("speechSynthesis" in window) || !text.trim()) return false;
  const cleanText = text.trim().replace(/\s+/g, " ");
  const requestId = ++speechRequestId;
  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) {
    speakWithLoadedVoices(cleanText, language, voices);
    return true;
  }

  const speakWhenReady = () => {
    window.clearTimeout(timeoutId);
    window.speechSynthesis.removeEventListener("voiceschanged", speakWhenReady);
    if (requestId !== speechRequestId) return;
    speakWithLoadedVoices(cleanText, language, window.speechSynthesis.getVoices());
  };
  window.speechSynthesis.addEventListener("voiceschanged", speakWhenReady, { once: true });
  const timeoutId = window.setTimeout(speakWhenReady, 500);
  return true;
}

export function setSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, String(enabled));
  } catch {
    // Le réglage reste simplement actif pour la session si le stockage est indisponible.
  }
  if (!enabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
  window.dispatchEvent(new Event(SOUND_EVENT));
}

export function useAudio() {
  const enabled = useSyncExternalStore(subscribe, storageEnabled, () => true);
  const toggle = useCallback(() => {
    const next = !storageEnabled();
    setSoundEnabled(next);
    if (next) playUISound("success");
  }, []);
  return { enabled, toggle };
}
