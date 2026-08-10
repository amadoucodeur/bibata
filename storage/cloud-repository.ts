import type { ConceptMastery, LearningPlan, LearningProfile, MissionProgress, PersistedState } from "@/types/learning";
import { encodeFilter, supabaseRequest } from "@/billing/supabase";

interface LearningProfileRow { id: string; client_profile_id: string; language_code: string; language_name: string; language_flag: string; cefr_level: LearningProfile["estimatedLevel"]; level_confidence: number; interests: string[]; ability: LearningProfile["ability"]; current_mission_id: string | null; learning_plan: LearningPlan | null; client_created_at: string; client_updated_at: string }
interface MissionProgressRow { learning_profile_id: string; mission_id: string; status: MissionProgress["status"]; score: number | null; completed_at: string | null; client_updated_at: string }
interface MasteryRow { learning_profile_id: string; concept_id: string; exposure_count: number; recognition: number; recall: number; context_understanding: number; production: number; mastery_score: number; confidence: number; correct_count: number; incorrect_count: number; conversation_use_count: number; assimilated_at: string | null; last_seen_at: string | null; next_suggested_exposure_at: string | null }
interface SettingsRow { active_language: string | null }

const iso = (value: number | undefined, fallback = Date.now()) => new Date(value && Number.isFinite(value) ? value : fallback).toISOString();
const millis = (value: string | null | undefined, fallback = Date.now()) => value ? Date.parse(value) : fallback;

function missionBelongsToProfile(missionId: string, profile: LearningProfile) {
  return profile.currentMissionId === missionId || profile.completedMissionIds.includes(missionId) || profile.learningPlan?.missions.some((mission) => mission.id === missionId);
}

export async function pushLearningState(userId: string, state: PersistedState) {
  await supabaseRequest("user_settings?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: userId, active_language: state.activeLanguage ?? null }) });
  if (!state.profiles.length) return;
  const profileRows = await supabaseRequest<LearningProfileRow[]>("learning_profiles?on_conflict=user_id,language_code", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(state.profiles.map((profile) => ({ user_id: userId, client_profile_id: profile.id, language_code: profile.language, language_name: profile.languageName, language_flag: profile.languageFlag, cefr_level: profile.estimatedLevel ?? "A1", level_confidence: profile.levelConfidence, interests: profile.interests, ability: profile.ability, current_mission_id: profile.currentMissionId ?? null, learning_plan: profile.learningPlan ?? null, client_created_at: iso(profile.createdAt), client_updated_at: iso(profile.updatedAt) }))),
  });
  const rowsByLanguage = new Map(profileRows.map((row) => [row.language_code, row]));
  const activeProfile = state.profiles.find((profile) => profile.language === state.activeLanguage) ?? state.profiles[0];
  const progressRows = Object.values(state.missionProgress).flatMap((progress) => {
    const owner = state.profiles.find((profile) => missionBelongsToProfile(progress.missionId, profile)) ?? activeProfile;
    const remote = owner && rowsByLanguage.get(owner.language);
    if (!remote) return [];
    return [{ learning_profile_id: remote.id, mission_id: progress.missionId, status: progress.status, score: progress.score ?? null, completed_at: progress.completedAt ? iso(progress.completedAt) : null, client_updated_at: iso(progress.completedAt ?? owner.updatedAt) }];
  });
  if (progressRows.length) await supabaseRequest("mission_progress?on_conflict=learning_profile_id,mission_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(progressRows) });
  const activeRemote = activeProfile && rowsByLanguage.get(activeProfile.language);
  if (activeRemote) {
    const masteryRows = Object.values(state.mastery).map((item) => ({ learning_profile_id: activeRemote.id, concept_id: item.conceptId, exposure_count: item.exposureCount, recognition: item.recognition, recall: item.recall, context_understanding: item.contextUnderstanding, production: item.production, mastery_score: item.masteryScore, confidence: item.confidence, correct_count: item.correctCount, incorrect_count: item.incorrectCount, conversation_use_count: item.conversationUseCount, assimilated_at: item.assimilatedAt ? iso(item.assimilatedAt) : null, last_seen_at: item.lastSeenAt ? iso(item.lastSeenAt) : null, next_suggested_exposure_at: item.nextSuggestedExposureAt ? iso(item.nextSuggestedExposureAt) : null }));
    if (masteryRows.length) await supabaseRequest("concept_mastery?on_conflict=learning_profile_id,concept_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(masteryRows) });
  }
}

export async function pullLearningState(userId: string): Promise<PersistedState> {
  const [profileRows, settings] = await Promise.all([
    supabaseRequest<LearningProfileRow[]>(`learning_profiles?user_id=eq.${encodeFilter(userId)}&select=*&order=created_at.asc`),
    supabaseRequest<SettingsRow[]>(`user_settings?user_id=eq.${encodeFilter(userId)}&select=active_language&limit=1`),
  ]);
  if (!profileRows.length) return { schemaVersion: 1, profiles: [], mastery: {}, missionProgress: {}, activeLanguage: settings[0]?.active_language ?? undefined };
  const ids = profileRows.map((row) => row.id).join(",");
  const [progressRows, masteryRows] = await Promise.all([
    supabaseRequest<MissionProgressRow[]>(`mission_progress?learning_profile_id=in.(${ids})&select=*`),
    supabaseRequest<MasteryRow[]>(`concept_mastery?learning_profile_id=in.(${ids})&select=*`),
  ]);
  const progressByProfile = new Map<string, MissionProgressRow[]>();
  for (const row of progressRows) progressByProfile.set(row.learning_profile_id, [...(progressByProfile.get(row.learning_profile_id) ?? []), row]);
  const profiles: LearningProfile[] = profileRows.map((row) => ({ id: row.client_profile_id, language: row.language_code, languageName: row.language_name, languageFlag: row.language_flag, estimatedLevel: row.cefr_level, levelConfidence: row.level_confidence, interests: row.interests, ability: row.ability, currentMissionId: row.current_mission_id ?? undefined, completedMissionIds: (progressByProfile.get(row.id) ?? []).filter((item) => item.status === "completed").map((item) => item.mission_id), learningPlan: row.learning_plan ?? undefined, createdAt: millis(row.client_created_at), updatedAt: millis(row.client_updated_at) }));
  const activeLanguage = settings[0]?.active_language ?? profiles[0]?.language;
  const activeRow = profileRows.find((row) => row.language_code === activeLanguage) ?? profileRows[0];
  const missionProgress = Object.fromEntries(progressRows.map((row) => [row.mission_id, { missionId: row.mission_id, status: row.status, score: row.score ?? undefined, completedAt: row.completed_at ? millis(row.completed_at) : undefined } satisfies MissionProgress]));
  const mastery = Object.fromEntries(masteryRows.filter((row) => row.learning_profile_id === activeRow.id).map((row) => [row.concept_id, { conceptId: row.concept_id, exposureCount: row.exposure_count, recognition: row.recognition, recall: row.recall, contextUnderstanding: row.context_understanding, production: row.production, masteryScore: row.mastery_score, confidence: row.confidence, correctCount: row.correct_count, incorrectCount: row.incorrect_count, conversationUseCount: row.conversation_use_count ?? 0, assimilatedAt: row.assimilated_at ? millis(row.assimilated_at) : undefined, lastSeenAt: row.last_seen_at ? millis(row.last_seen_at) : undefined, nextSuggestedExposureAt: row.next_suggested_exposure_at ? millis(row.next_suggested_exposure_at) : undefined } satisfies ConceptMastery]));
  return { schemaVersion: 1, profiles, missionProgress, mastery, activeLanguage };
}

export async function deleteLearningState(userId: string) {
  await supabaseRequest(`learning_profiles?user_id=eq.${encodeFilter(userId)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  await supabaseRequest(`user_settings?user_id=eq.${encodeFilter(userId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ active_language: null, updated_at: new Date().toISOString() }) });
}
