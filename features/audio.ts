"use client";

import { useCallback, useSyncExternalStore } from "react";

export type UISound = "transition" | "success" | "error" | "message" | "send" | "complete";

const SOUND_KEY = "bibata-sound-enabled";
const SOUND_EVENT = "bibata-sound-change";
let context: AudioContext | undefined;

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

export function speakText(text: string, language: string) {
  if (typeof window === "undefined" || !storageEnabled() || !("speechSynthesis" in window) || !text.trim()) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = speechLocaleFor(language);
  utterance.rate = .86;
  utterance.pitch = 1;
  const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith(utterance.lang.slice(0, 2).toLowerCase()));
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
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
