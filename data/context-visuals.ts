export interface ContextVisual {
  src: string;
  alt: string;
}

type ContextVisualInput = {
  categories: string[];
  conceptId?: string;
  interest?: string;
  missionId?: string;
  title?: string;
  setting?: string;
};

type VisualEntry = ContextVisual & {
  tags: string[];
  interests?: string[];
};

const VISUALS: VisualEntry[] = [
  { src: "/context/social.webp", alt: "Deux personnes se rencontrent dans un café à Abidjan", tags: ["introductions", "social", "politeness", "greeting"] },
  { src: "/context/cafe.webp", alt: "Une cliente échange avec une serveuse dans un café contemporain à Abidjan", tags: ["requests", "needs", "food", "service", "politeness", "quantity"], interests: ["food"] },
  { src: "/context/routine.webp", alt: "Une jeune femme commence sa journée dans son appartement", tags: ["routine", "storytelling", "time", "sequence", "preferences", "adaptation"] },
  { src: "/context/city.webp", alt: "Une personne demande son chemin près d’un arrêt de bus à Abidjan", tags: ["city", "place", "travel", "directions", "discovery"], interests: ["travel"] },
  { src: "/context/plans.webp", alt: "Deux amis organisent une sortie sur une terrasse à Abidjan", tags: ["plans", "preferences", "possibility", "music", "cinema", "sport", "social"], interests: ["music", "cinema", "sport"] },
  { src: "/context/collaboration.webp", alt: "Une équipe échange autour d’un projet", tags: ["collaboration", "leadership", "work", "negotiation", "discussion", "problem-solving", "business"], interests: ["business", "technology"] },
  { src: "/context/analysis.webp", alt: "Deux professionnels comparent des options et des éléments de décision", tags: ["analysis", "decision", "argument", "evidence", "trade-off", "consequence", "impact", "patterns", "science", "technology"], interests: ["science", "technology", "business"] },
  { src: "/context/nuance.webp", alt: "Deux personnes développent une idée au cours d’une discussion", tags: ["opinion", "nuance", "subtext", "rhetoric", "contrast", "synthesis", "advice"] },
];

const CATEGORY_ALIASES: Record<string, string[]> = {
  obligation: ["needs", "requests"],
  effort: ["storytelling", "adaptation"],
  explanation: ["analysis", "discussion"],
  change: ["decision", "impact"],
};

const hash = (value: string) => {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const tokens = (value = "") => value.toLocaleLowerCase().match(/[\p{L}\p{N}-]+/gu) ?? [];

export function getContextVisual(input: string[] | ContextVisualInput): ContextVisual {
  const context: ContextVisualInput = Array.isArray(input) ? { categories: input } : input;
  const semanticTags = new Set([
    ...context.categories,
    ...context.categories.flatMap((category) => CATEGORY_ALIASES[category] ?? []),
    ...tokens(context.title),
    ...tokens(context.setting),
    ...(context.interest ? [context.interest] : []),
  ]);
  const seed = context.missionId ?? context.conceptId ?? [...semanticTags].join("-");
  const ranked = VISUALS.map((visual, index) => ({
    visual,
    score: visual.tags.reduce((sum, tag) => sum + (semanticTags.has(tag) ? 3 : 0), 0)
      + (context.interest && visual.interests?.includes(context.interest) ? 4 : 0),
    tieBreak: hash(`${seed}-${visual.src}`) + index,
  })).sort((left, right) => right.score - left.score || left.tieBreak - right.tieBreak);
  return ranked[0].visual;
}
