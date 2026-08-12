import type { CEFRLevel, ConversationMessage, ConversationScenario, LearningPlan, PersonalizedMissionPlan } from "@/types/learning";

export interface AIProvider {
  generateConversationTurn(
    scenario: ConversationScenario,
    messages: ConversationMessage[],
    level: CEFRLevel,
  ): Promise<ConversationMessage>;
  generateLearningPlan(level: CEFRLevel, interests: string[], learnerSeed: string, excludedConceptIds?: string[]): Promise<LearningPlan>;
  generateNextMission(plan: LearningPlan, interests: string[], excludedConceptIds?: string[]): Promise<PersonalizedMissionPlan>;
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
    && message.text.trim().length > 0
    && (message.validatedConcepts === undefined
      || (Array.isArray(message.validatedConcepts)
        && message.validatedConcepts.length <= 12
        && message.validatedConcepts.every((target) => typeof target === "string" && target.trim().length > 0)));
};

const isLearningPlan = (value: unknown): value is LearningPlan => {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<LearningPlan>;
  return typeof plan.id === "string"
    && typeof plan.level === "string"
    && typeof plan.title === "string"
    && typeof plan.focus === "string"
    && typeof plan.createdAt === "number"
    && typeof plan.learnerSeed === "string"
    && Array.isArray(plan.missions)
    && plan.missions.length >= 1
    && plan.missions.every((mission) => (
      typeof mission.id === "string"
      && typeof mission.order === "number"
      && typeof mission.title === "string"
      && Array.isArray(mission.conceptIds)
      && mission.conceptIds.length >= 1
      && mission.conceptIds.length <= 3
      && typeof mission.conversation?.opening === "string"
    ));
};

const isPersonalizedMissionPlan = (value: unknown): value is PersonalizedMissionPlan => {
  if (!value || typeof value !== "object") return false;
  const mission = value as Partial<PersonalizedMissionPlan>;
  return typeof mission.id === "string"
    && typeof mission.order === "number"
    && mission.order >= 1
    && typeof mission.title === "string"
    && typeof mission.eyebrow === "string"
    && typeof mission.description === "string"
    && typeof mission.interest === "string"
    && (mission.kind === undefined || mission.kind === "learning" || mission.kind === "consolidation")
    && Array.isArray(mission.conceptIds)
    && mission.conceptIds.length >= 1
    && mission.conceptIds.length <= 3
    && typeof mission.conversation?.opening === "string"
    && typeof mission.conversation?.characterName === "string";
};

export class MammouthAIProvider implements AIProvider {
  private async request(action: string, payload: unknown, timeout: number) {
    let response: Response;
    try {
      response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
        signal: AbortSignal.timeout(timeout),
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
    return result.data;
  }

  async generateConversationTurn(
    scenario: ConversationScenario,
    messages: ConversationMessage[],
    level: CEFRLevel,
  ): Promise<ConversationMessage> {
    const data = await this.request("generateConversationTurn", { scenario, messages, level }, 15_000);
    if (!isConversationMessage(data)) {
      throw new AIProviderError("INVALID_API_RESPONSE", 502, "Invalid AI API response");
    }
    return data;
  }

  async generateLearningPlan(level: CEFRLevel, interests: string[], learnerSeed: string, excludedConceptIds: string[] = []): Promise<LearningPlan> {
    const timeout = level === "C1" || level === "C2" ? 36_000 : 24_000;
    const data = await this.request("generateLearningPlan", { level, interests, learnerSeed, excludedConceptIds }, timeout);
    if (!isLearningPlan(data)) {
      throw new AIProviderError("INVALID_API_RESPONSE", 502, "Invalid AI learning plan");
    }
    return data;
  }

  async generateNextMission(plan: LearningPlan, interests: string[], excludedConceptIds: string[] = []): Promise<PersonalizedMissionPlan> {
    const data = await this.request("generateNextMission", {
      level: plan.level,
      interests,
      learnerSeed: plan.learnerSeed,
      planId: plan.id,
      focus: plan.focus,
      nextOrder: plan.missions.length + 1,
      previousTitles: plan.missions.slice(-4).map((mission) => mission.title),
      excludedConceptIds,
    }, plan.level === "C1" || plan.level === "C2" ? 30_000 : 22_000);
    if (!isPersonalizedMissionPlan(data)) {
      throw new AIProviderError("INVALID_API_RESPONSE", 502, "Invalid AI mission");
    }
    return data;
  }
}

export const aiProvider: AIProvider = new MammouthAIProvider();
