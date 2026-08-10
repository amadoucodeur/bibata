export interface ContextVisual {
  src: string;
  alt: string;
}

const VISUALS: Record<string, ContextVisual> = {
  social: { src: "/context/social.webp", alt: "Deux personnes se rencontrent dans un café à Abidjan" },
  routine: { src: "/context/routine.webp", alt: "Une jeune femme commence sa journée dans son appartement" },
  city: { src: "/context/city.webp", alt: "Une personne demande son chemin près d’un arrêt de bus à Abidjan" },
  collaboration: { src: "/context/collaboration.webp", alt: "Une équipe échange autour d’un projet" },
  nuance: { src: "/context/nuance.webp", alt: "Deux personnes développent une idée au cours d’une discussion" },
};

const CATEGORY_VISUAL: Record<string, keyof typeof VISUALS> = {
  introductions: "social",
  plans: "social",
  routine: "routine",
  storytelling: "routine",
  city: "city",
  discussion: "collaboration",
  "problem-solving": "collaboration",
  leadership: "collaboration",
  opinion: "nuance",
  nuance: "nuance",
  subtext: "nuance",
  rhetoric: "nuance",
};

export function getContextVisual(categories: string[]): ContextVisual {
  const key = categories.map((category) => CATEGORY_VISUAL[category]).find(Boolean) ?? "social";
  return VISUALS[key];
}
