import type { ConversationMessage, ConversationScenario, Exercise } from "@/types/learning";

export interface AIProvider {
  generateExercise(conceptIds: string[]): Promise<Exercise[]>;
  generateContext(conceptIds: string[]): Promise<string>;
  evaluateFreeAnswer(answer: string, expectedMeaning: string): Promise<{ accepted: boolean; feedback: string }>;
  generateConversationTurn(
    scenario: ConversationScenario,
    messages: ConversationMessage[],
  ): Promise<ConversationMessage>;
  generateCustomMission(interest: string, level: string): Promise<{ title: string; description: string }>;
}

type AIAction =
  | "generateExercise"
  | "generateContext"
  | "evaluateFreeAnswer"
  | "generateConversationTurn"
  | "generateCustomMission";

class MammouthAIProvider implements AIProvider {
  private async request<T>(action: AIAction, payload: Record<string, unknown>): Promise<T> {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Mammouth is temporarily unavailable");
    const result = (await response.json()) as { data?: T };
    if (result.data === undefined) throw new Error("Invalid Mammouth response");
    return result.data;
  }

  generateExercise(conceptIds: string[]) {
    return this.request<Exercise[]>("generateExercise", { conceptIds });
  }

  generateContext(conceptIds: string[]) {
    return this.request<string>("generateContext", { conceptIds });
  }

  evaluateFreeAnswer(answer: string, expectedMeaning: string) {
    return this.request<{ accepted: boolean; feedback: string }>("evaluateFreeAnswer", {
      answer,
      expectedMeaning,
    });
  }

  generateConversationTurn(scenario: ConversationScenario, messages: ConversationMessage[]) {
    return this.request<ConversationMessage>("generateConversationTurn", { scenario, messages });
  }

  generateCustomMission(interest: string, level: string) {
    return this.request<{ title: string; description: string }>("generateCustomMission", {
      interest,
      level,
    });
  }
}

export class MockAIProvider implements AIProvider {
  async generateExercise() {
    return [];
  }

  async generateContext(conceptIds: string[]) {
    return `Contexte préparé pour ${conceptIds.join(", ")}.`;
  }

  async evaluateFreeAnswer(answer: string) {
    return {
      accepted: answer.trim().length > 2,
      feedback: answer.trim().length > 2 ? "Bien joué — ton message est clair." : "Essaie une phrase un peu plus complète.",
    };
  }

  async generateConversationTurn(
    scenario: ConversationScenario,
    messages: ConversationMessage[],
  ): Promise<ConversationMessage> {
    const learnerTurns = messages.filter((message) => message.role === "learner").length;
    const lines =
      scenario.id === "intro-party"
        ? ["Nice to meet you! Where are you from?", "That sounds great. What do you enjoy doing?", "Lovely meeting you — see you soon!"]
        : ["What time do you usually wake up?", "And what do you do after work?", "That sounds like a good routine!"];
    return {
      id: `mock-${Date.now()}`,
      role: "character",
      text: lines[Math.min(learnerTurns - 1, lines.length - 1)],
    };
  }

  async generateCustomMission(interest: string, level: string) {
    return { title: `${interest} essentials`, description: `Une mission ${level} inspirée par ${interest}.` };
  }
}

class FallbackAIProvider implements AIProvider {
  constructor(
    private readonly primary: AIProvider,
    private readonly fallback: AIProvider,
  ) {}

  private async run<T>(primary: () => Promise<T>, fallback: () => Promise<T>) {
    try {
      return await primary();
    } catch {
      return fallback();
    }
  }

  generateExercise(conceptIds: string[]) {
    return this.run(
      () => this.primary.generateExercise(conceptIds),
      () => this.fallback.generateExercise(conceptIds),
    );
  }

  generateContext(conceptIds: string[]) {
    return this.run(
      () => this.primary.generateContext(conceptIds),
      () => this.fallback.generateContext(conceptIds),
    );
  }

  evaluateFreeAnswer(answer: string, expectedMeaning: string) {
    return this.run(
      () => this.primary.evaluateFreeAnswer(answer, expectedMeaning),
      () => this.fallback.evaluateFreeAnswer(answer, expectedMeaning),
    );
  }

  generateConversationTurn(scenario: ConversationScenario, messages: ConversationMessage[]) {
    return this.run(
      () => this.primary.generateConversationTurn(scenario, messages),
      () => this.fallback.generateConversationTurn(scenario, messages),
    );
  }

  generateCustomMission(interest: string, level: string) {
    return this.run(
      () => this.primary.generateCustomMission(interest, level),
      () => this.fallback.generateCustomMission(interest, level),
    );
  }
}

export const aiProvider: AIProvider = new FallbackAIProvider(
  new MammouthAIProvider(),
  new MockAIProvider(),
);
