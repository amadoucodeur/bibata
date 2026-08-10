import type { ConceptMastery, LearningProfile, MissionProgress, PersistedState } from "@/types/learning";
import { deleteCloudLearningState, queueCloudPush } from "@/storage/cloud-sync";
import { sanitizePersistedState } from "@/storage/state-validation";

const DB_NAME = "bibata";
const STORE_NAME = "learning-state";
const STATE_KEY = "current";
const SCHEMA_VERSION = 1;

export const emptyState: PersistedState = {
  schemaVersion: SCHEMA_VERSION,
  profiles: [],
  mastery: {},
  missionProgress: {},
};

export interface StorageRepository {
  getState(): Promise<PersistedState>;
  saveState(state: PersistedState): Promise<void>;
  getLearningProfiles(): Promise<LearningProfile[]>;
  saveLearningProfile(profile: LearningProfile): Promise<void>;
  getConceptMastery(): Promise<Record<string, ConceptMastery>>;
  saveConceptMastery(mastery: Record<string, ConceptMastery>): Promise<void>;
  saveMissionProgress(progress: MissionProgress): Promise<void>;
  reset(): Promise<void>;
  exportJSON(): Promise<string>;
  importJSON(value: string): Promise<PersistedState>;
}

const parseState = (value: unknown): PersistedState => sanitizePersistedState(value);

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    let settled = false;
    const timeout = window.setTimeout(() => {
      settled = true;
      reject(new Error("IndexedDB open timed out"));
    }, 1_500);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      window.clearTimeout(timeout);
      if (settled) request.result.close();
      else { settled = true; resolve(request.result); }
    };
    request.onerror = () => {
      window.clearTimeout(timeout);
      if (!settled) { settled = true; reject(request.error); }
    };
    request.onblocked = () => {
      window.clearTimeout(timeout);
      if (!settled) { settled = true; reject(new Error("IndexedDB is blocked")); }
    };
  });
}

async function readIndexedDB(): Promise<PersistedState> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(parseState(request.result));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

async function writeIndexedDB(state: PersistedState): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
    transaction.oncomplete = () => {
      db.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export class IndexedDBStorageRepository implements StorageRepository {
  private memoryState = structuredClone(emptyState);
  private hydrated = false;
  private writeQueue = Promise.resolve();

  async getState() {
    if (this.hydrated) return structuredClone(this.memoryState);
    try {
      this.memoryState = await readIndexedDB();
    } catch {
      const fallback = typeof localStorage !== "undefined" ? localStorage.getItem(DB_NAME) : null;
      try {
        this.memoryState = fallback ? parseState(JSON.parse(fallback)) : structuredClone(emptyState);
      } catch {
        this.memoryState = structuredClone(emptyState);
      }
    }
    this.hydrated = true;
    return structuredClone(this.memoryState);
  }

  async saveState(state: PersistedState) {
    this.memoryState = parseState(state);
    this.hydrated = true;
    const snapshot = structuredClone(this.memoryState);
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await writeIndexedDB(snapshot);
      } catch {
        if (typeof localStorage !== "undefined") localStorage.setItem(DB_NAME, JSON.stringify(snapshot));
      }
    });
    await this.writeQueue;
    queueCloudPush(snapshot);
  }

  async getLearningProfiles() {
    return (await this.getState()).profiles;
  }

  async saveLearningProfile(profile: LearningProfile) {
    const state = await this.getState();
    state.profiles = [...state.profiles.filter((item) => item.id !== profile.id), profile];
    state.activeLanguage = profile.language;
    await this.saveState(state);
  }

  async getConceptMastery() {
    return (await this.getState()).mastery;
  }

  async saveConceptMastery(mastery: Record<string, ConceptMastery>) {
    const state = await this.getState();
    state.mastery = mastery;
    await this.saveState(state);
  }

  async saveMissionProgress(progress: MissionProgress) {
    const state = await this.getState();
    state.missionProgress[progress.missionId] = progress;
    await this.saveState(state);
  }

  async reset() {
    deleteCloudLearningState();
    await this.saveState(structuredClone(emptyState));
  }

  async exportJSON() {
    return JSON.stringify(await this.getState(), null, 2);
  }

  async importJSON(value: string) {
    const state = parseState(JSON.parse(value));
    await this.saveState(state);
    return state;
  }
}

export const storageRepository = new IndexedDBStorageRepository();
