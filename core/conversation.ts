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
