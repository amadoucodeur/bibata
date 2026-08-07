import type { CEFRLevel, ConversationMessage, ConversationScenario } from "@/types/learning";

export interface AIProvider {
  generateConversationTurn(
    scenario: ConversationScenario,
    messages: ConversationMessage[],
    level: CEFRLevel,
  ): Promise<ConversationMessage>;
}

interface AIErrorResponse {
  code?: unknown;
  error?: unknown;
}

export class AIProviderError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const isConversationMessage = (value: unknown): value is ConversationMessage => {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ConversationMessage>;
  return typeof message.id === "string"
    && message.role === "character"
    && typeof message.text === "string"
    && message.text.trim().length > 0;
};

export class MammouthAIProvider implements AIProvider {
  async generateConversationTurn(
    scenario: ConversationScenario,
    messages: ConversationMessage[],
    level: CEFRLevel,
  ): Promise<ConversationMessage> {
    let response: Response;
    try {
      response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generateConversationTurn", payload: { scenario, messages, level } }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      const code = error instanceof Error && error.name === "TimeoutError"
        ? "MAMMOUTH_TIMEOUT"
        : "MAMMOUTH_UNREACHABLE";
      throw new AIProviderError(code, code === "MAMMOUTH_TIMEOUT" ? 504 : 502, "AI request failed");
    }

    let result: { data?: unknown } & AIErrorResponse;
    try {
      result = (await response.json()) as { data?: unknown } & AIErrorResponse;
    } catch {
      throw new AIProviderError("INVALID_API_RESPONSE", 502, "Invalid AI API response");
    }

    if (!response.ok) {
      throw new AIProviderError(
        typeof result.code === "string" ? result.code : "AI_SERVICE_ERROR",
        response.status,
        typeof result.error === "string" ? result.error : "AI service unavailable",
      );
    }
    if (!isConversationMessage(result.data)) {
      throw new AIProviderError("INVALID_API_RESPONSE", 502, "Invalid AI API response");
    }
    return result.data;
  }
}

export const aiProvider: AIProvider = new MammouthAIProvider();
