import { concepts, getMissionsForLevel } from "@/data/curriculum";
import type { Concept, Exercise, LearningPlan, LearningProfile, Mission } from "@/types/learning";

const hash = (value: string) => {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const rotate = <T,>(items: T[], seed: string) => {
  if (items.length < 2) return items;
  const offset = hash(seed) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
};

const difficultyFloor = { A1: 0.14, A2: 0.3, B1: 0.48, B2: 0.64, C1: 0.76, C2: 0.87 } as const;

const buildExercises = (planId: string, order: number, missionConcepts: Concept[], level: LearningPlan["level"]): Exercise[] => {
  const levelConcepts = concepts.filter((item) => item.level === level);
  const first = missionConcepts[0];
  const second = missionConcepts[1] ?? first;
  const third = missionConcepts[2] ?? second;
  const distractors = (target: Concept, field: "value" | "translation") => rotate(
    levelConcepts.filter((item) => item.id !== target.id).map((item) => item[field]).filter((item): item is string => Boolean(item)),
    `${planId}-${target.id}-${field}`,
  ).slice(0, 2);
  const example = third.examples[0]?.text ?? third.value;
  const tokens = rotate(example.replace(/[.!?]/g, "").split(/\s+/).filter(Boolean), `${planId}-${order}-tokens`);
  const base = difficultyFloor[level];

  return [
    {
      id: `${planId}-${order}-meaning`, type: "multiple_choice", concepts: [first.id],
      prompt: `Quelle formulation correspond à « ${first.translation ?? first.value} » ?`, difficulty: base,
      payload: { choices: rotate([first.value, ...distractors(first, "value")], `${planId}-${order}-meaning`), answer: first.value }, evaluationMode: "local",
    },
    {
      id: `${planId}-${order}-context`, type: "multiple_choice", concepts: [second.id],
      prompt: `Quel concept convient à cette idée : « ${second.examples[0]?.translation ?? second.translation} » ?`, difficulty: Math.min(0.96, base + 0.05),
      payload: { choices: rotate([second.value, ...distractors(second, "value")], `${planId}-${order}-context`), answer: second.value }, evaluationMode: "local",
    },
    {
      id: `${planId}-${order}-production`, type: "sentence_builder", concepts: [third.id],
      prompt: `Reconstruis naturellement : « ${third.examples[0]?.translation ?? third.translation} »`, difficulty: Math.min(0.98, base + 0.1),
      payload: { tokens, answer: example }, evaluationMode: "local",
    },
  ];
};

export function buildMissionsFromPlan(plan: LearningPlan, assimilatedConceptIds: Iterable<string> = []): Mission[] {
  const assimilated = new Set(assimilatedConceptIds);
  const built: Mission[] = [];
  for (const missionPlan of plan.missions) {
    const missionEntries = missionPlan.conceptIds.flatMap((id, index): Array<{ concept: Concept; objective?: string }> => {
      const concept = concepts.find((item) => item.id === id && item.level === plan.level);
      return concept && !assimilated.has(concept.id)
        ? [{ concept, objective: missionPlan.conversation.objectives[index] }]
        : [];
    });
    const missionConcepts = missionEntries.map((entry) => entry.concept);

    if (!missionConcepts.length) continue;

    built.push({
      id: missionPlan.id,
      level: plan.level,
      worldId: "foundations",
      order: missionPlan.order,
      title: missionPlan.title,
      eyebrow: missionPlan.eyebrow,
      description: missionPlan.description,
      durationMinutes: plan.level === "C1" || plan.level === "C2" ? 10 : plan.level === "B1" || plan.level === "B2" ? 8 : 6,
      conceptIds: missionConcepts.map((item) => item.id),
      exercises: buildExercises(plan.id, missionPlan.order, missionConcepts, plan.level),
      conversation: {
        id: `${missionPlan.id}-conversation`,
        title: missionPlan.conversation.title,
        setting: missionPlan.conversation.setting,
        characterName: missionPlan.conversation.characterName,
        characterRole: missionPlan.conversation.characterRole,
        objectives: missionEntries.map((entry) => entry.objective ?? `utiliser « ${entry.concept.value} » naturellement`),
        targetConcepts: missionConcepts.map((item) => item.value),
        suggestedReplies: missionConcepts.map((item) => item.examples[0]?.text ?? item.value),
        opening: missionPlan.conversation.opening,
      },
    });
  }
  return built;
}

export function getMissionsForProfile(profile?: LearningProfile, fallbackLevel = profile?.estimatedLevel ?? "A1", assimilatedConceptIds: Iterable<string> = []) {
  if (profile?.learningPlan?.level === fallbackLevel && profile.learningPlan.missions.length > 0) {
    const completeMissions = buildMissionsFromPlan(profile.learningPlan);
    const futureMissions = buildMissionsFromPlan(profile.learningPlan, assimilatedConceptIds);
    return completeMissions
      .map((mission) => profile.completedMissionIds.includes(mission.id)
        ? mission
        : futureMissions.find((candidate) => candidate.id === mission.id))
      .filter((mission): mission is Mission => Boolean(mission));
  }
  if (profile) return [];
  return getMissionsForLevel(fallbackLevel);
}
