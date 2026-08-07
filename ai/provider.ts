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

export const aiProvider: AIProvider = new MockAIProvider();
