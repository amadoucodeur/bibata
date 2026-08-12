import type { ConversationMessage } from "@/types/learning";

export const countCompletedConversationTurns = (messages: ConversationMessage[]) =>
  Math.max(0, messages.filter((message) => message.role === "character").length - 1);

const normalizedReply = (value: string) => value.toLocaleLowerCase().replace(/[.!?,’']/g, "").replace(/\s+/g, " ").trim();

export function getAvailableConversationReplies(suggestions: string[], messages: ConversationMessage[], limit = 2) {
  const completedTurns = countCompletedConversationTurns(messages);
  const usedReplies = new Set(messages.filter((message) => message.role === "learner").map((message) => normalizedReply(message.text)));
  const rotated = [...suggestions.slice(completedTurns), ...suggestions.slice(0, completedTurns)];
  return rotated.filter((reply) => !usedReplies.has(normalizedReply(reply))).slice(0, limit);
}

export function getDirectConversationOpening(opening?: string) {
  const text = opening?.trim() ?? "";
  const soundsLikeNarration = /^(you(?:'re| are) (?:exploring|walking|visiting|standing|entering)|imagine|picture|scenario:|the scene)/i.test(text);
  return text && !soundsLikeNarration
    ? text
    : "Hi! Let's explore this together. What would you like to do first?";
}

const TOKEN_LEMMAS: Record<string, string> = {
  am: "be", is: "be", are: "be", was: "be", were: "be", been: "be", being: "be",
  looks: "look", looked: "look", looking: "look",
  gives: "give", gave: "give", given: "give", giving: "give",
  comes: "come", came: "come", coming: "come",
  finds: "find", found: "find", finding: "find",
  takes: "take", took: "take", taken: "take", taking: "take",
  brings: "bring", brought: "bring", bringing: "bring",
  wakes: "wake", woke: "wake", woken: "wake", waking: "wake",
  ends: "end", ended: "end", ending: "end",
  agrees: "agree", agreed: "agree", agreeing: "agree",
  carries: "carry", carried: "carry", carrying: "carry",
  points: "point", pointed: "point", pointing: "point",
  reaches: "reach", reached: "reach", reaching: "reach",
  raises: "raise", raised: "raise", raising: "raise",
  sheds: "shed", shedding: "shed",
  calls: "call", called: "call", calling: "call",
  paves: "pave", paved: "pave", paving: "pave",
  uses: "use", used: "use", using: "use",
};

const expandContractions = (value: string) => value
  .toLocaleLowerCase()
  .replace(/[’]/g, "'")
  .replace(/\bi'm\b/g, "i am")
  .replace(/\b(you|we|they)'re\b/g, "$1 are")
  .replace(/\b(he|she|it)'s\b/g, "$1 is")
  .replace(/\bi'd\b/g, "i would")
  .replace(/\b(you|he|she|we|they)'d\b/g, "$1 would")
  .replace(/\bcan't\b/g, "can not")
  .replace(/\bwon't\b/g, "will not")
  .replace(/\b(\p{L}+?)n't\b/gu, "$1 not");

const normalizedConcept = (value: string) => expandContractions(value)
  .replace(/[^\p{L}\p{N}]+/gu, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((token) => TOKEN_LEMMAS[token] ?? token)
  .join(" ");

export function findConceptCandidatesInText(targets: string[], learnerText: string) {
  const text = ` ${normalizedConcept(learnerText)} `;
  return targets.filter((target) => {
    const phrase = normalizedConcept(target);
    if (!phrase) return false;
    const variants = phrase.startsWith("that ") ? [phrase, phrase.slice(5)] : [phrase];
    return variants.some((variant) => variant && text.includes(` ${variant} `));
  });
}

export function findConceptsUsedByLearner(targets: Array<{ id: string; value: string }>, messages: ConversationMessage[]) {
  const validated = new Set(
    messages
      .flatMap((message) => message.validatedConcepts ?? [])
      .map(normalizedConcept)
      .filter(Boolean),
  );
  return targets
    .filter((target) => validated.has(normalizedConcept(target.value)))
    .map((target) => target.id);
}
