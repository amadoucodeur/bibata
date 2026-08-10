import type { ConceptMastery, LearningProfile, MissionProgress, PersistedState } from "@/types/learning";

function mergeProfile(local: LearningProfile | undefined, remote: LearningProfile | undefined) {
  if (!local) return remote;
  if (!remote) return local;
  const newest = local.updatedAt >= remote.updatedAt ? local : remote;
  return { ...newest, completedMissionIds: [...new Set([...local.completedMissionIds, ...remote.completedMissionIds])] };
}

function mergeProgress(local: MissionProgress | undefined, remote: MissionProgress | undefined) {
  if (!local) return remote;
  if (!remote) return local;
  if (local.status === "completed" && remote.status !== "completed") return local;
  if (remote.status === "completed" && local.status !== "completed") return remote;
  return (local.completedAt ?? 0) >= (remote.completedAt ?? 0) ? local : remote;
}

function mergeMastery(local: ConceptMastery | undefined, remote: ConceptMastery | undefined) {
  if (!local) return remote;
  if (!remote) return local;
  const localFreshness = local.lastSeenAt ?? local.exposureCount;
  const remoteFreshness = remote.lastSeenAt ?? remote.exposureCount;
  return localFreshness >= remoteFreshness ? local : remote;
}

export function mergeLearningStates(local: PersistedState, remote: PersistedState): PersistedState {
  const languages = new Set([...local.profiles.map((profile) => profile.language), ...remote.profiles.map((profile) => profile.language)]);
  const profiles = [...languages].map((language) => mergeProfile(local.profiles.find((item) => item.language === language), remote.profiles.find((item) => item.language === language))).filter((item): item is LearningProfile => Boolean(item));
  const missionIds = new Set([...Object.keys(local.missionProgress), ...Object.keys(remote.missionProgress)]);
  const conceptIds = new Set([...Object.keys(local.mastery), ...Object.keys(remote.mastery)]);
  return {
    schemaVersion: Math.max(local.schemaVersion, remote.schemaVersion),
    profiles,
    missionProgress: Object.fromEntries([...missionIds].map((id) => [id, mergeProgress(local.missionProgress[id], remote.missionProgress[id])]).filter((entry): entry is [string, MissionProgress] => Boolean(entry[1]))),
    mastery: Object.fromEntries([...conceptIds].map((id) => [id, mergeMastery(local.mastery[id], remote.mastery[id])]).filter((entry): entry is [string, ConceptMastery] => Boolean(entry[1]))),
    activeLanguage: local.activeLanguage ?? remote.activeLanguage ?? profiles[0]?.language,
  };
}

export async function mergeFromCloud(local: PersistedState) {
  try {
    const response = await fetch("/api/sync", { cache: "no-store" });
    if (!response.ok) return local;
    const payload = await response.json() as { state?: PersistedState };
    if (!payload.state) return local;
    lastSyncedState = structuredClone(payload.state);
    return mergeLearningStates(local, payload.state);
  } catch {
    return local;
  }
}

let pushTimer: number | undefined;
let pendingState: PersistedState | undefined;
let lastSyncedState: PersistedState | undefined;

function changedRecords<T>(current: Record<string, T>, previous: Record<string, T> | undefined) {
  if (!previous) return current;
  return Object.fromEntries(Object.entries(current).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(previous[key])));
}

export function buildLearningSyncDelta(state: PersistedState, previous?: PersistedState): PersistedState {
  return {
    schemaVersion: state.schemaVersion,
    // Profiles are few and carry the mission-to-language relationship needed by the server.
    profiles: state.profiles,
    activeLanguage: state.activeLanguage,
    missionProgress: changedRecords(state.missionProgress, previous?.missionProgress),
    mastery: changedRecords(state.mastery, previous?.mastery),
  };
}

export function queueCloudPush(state: PersistedState) {
  if (typeof window === "undefined") return;
  pendingState = structuredClone(state);
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(async () => {
    const snapshot = pendingState;
    pendingState = undefined;
    if (!snapshot || !navigator.onLine) return;
    const delta = buildLearningSyncDelta(snapshot, lastSyncedState);
    try {
      const response = await fetch("/api/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(delta) });
      if (response.ok) lastSyncedState = { ...mergeLearningStates(lastSyncedState ?? { schemaVersion: 1, profiles: [], mastery: {}, missionProgress: {} }, delta), activeLanguage: snapshot.activeLanguage };
    } catch {
      // IndexedDB reste la source locale ; une prochaine modification retentera la synchronisation.
    }
  }, 1_500);
}

export function deleteCloudLearningState() {
  if (typeof window === "undefined" || !navigator.onLine) return;
  pendingState = undefined;
  lastSyncedState = undefined;
  window.clearTimeout(pushTimer);
  void fetch("/api/sync", { method: "DELETE", keepalive: true }).catch(() => undefined);
}
