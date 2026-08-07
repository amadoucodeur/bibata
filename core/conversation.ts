import type { ConversationMessage } from "@/types/learning";

export const countCompletedConversationTurns = (messages: ConversationMessage[]) =>
  Math.max(0, messages.filter((message) => message.role === "character").length - 1);
