import { CEFR_LEVELS, type CEFRLevel, type ConversationMessage, type ConversationScenario } from "@/types/learning";

const MAMMOUTH_URL = "https://api.mammouth.ai/v1/chat/completions";
const MAX_BODY_SIZE = 32_000;

type ModelTier = "beginner" | "intermediate" | "advanced";

const DEFAULT_MODELS: Record<ModelTier, string> = {
  beginner: "mistral-small-2603",
  intermediate: "mistral-medium-3.1",
  advanced: "glm-5.2",
};

const MODEL_ENV_KEYS: Record<ModelTier, string> = {
  beginner: "MAMMOUTH_MODEL_BEGINNER",
  intermediate: "MAMMOUTH_MODEL_INTERMEDIATE",
  advanced: "MAMMOUTH_MODEL_ADVANCED",
};

const LEVEL_CONFIG: Record<CEFRLevel, { guidance: string; maxTokens: number; modelTier: ModelTier }> = {
  A1: { guidance: "Use basic vocabulary and one short sentence of at most 18 words.", maxTokens: 80, modelTier: "beginner" },
  A2: { guidance: "Use common vocabulary and up to two short sentences totaling at most 24 words.", maxTokens: 100, modelTier: "beginner" },
  B1: { guidance: "Use natural everyday language, varied sentence structures, and at most 35 words.", maxTokens: 140, modelTier: "intermediate" },
  B2: { guidance: "Use fluent, idiomatic language and invite the learner to justify an idea, in at most 45 words.", maxTokens: 180, modelTier: "intermediate" },
  C1: { guidance: "Use nuanced, precise language and a natural conversational challenge, in at most 55 words.", maxTokens: 220, modelTier: "advanced" },
  C2: { guidance: "Use sophisticated, idiomatic language with subtle nuance while staying conversational, in at most 65 words.", maxTokens: 260, modelTier: "advanced" },
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface MammouthResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface AIRequest {
  action?: unknown;
  payload?: unknown;
}

class AIRouteError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const cleanText = (value: unknown, maxLength = 2_000) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const isStringArray = (value: unknown, limit: number) =>
  Array.isArray(value)
  && value.length <= limit
  && value.every((item) => typeof item === "string" && item.trim().length > 0);

const isAbortError = (error: unknown) =>
  error instanceof Error && error.name === "AbortError";

const errorResponse = (status: number, code: string, error: string) =>
  Response.json({ error, code }, { status });

const resolveModel = (tier: ModelTier) =>
  process.env[MODEL_ENV_KEYS[tier]]?.trim() || DEFAULT_MODELS[tier];

function parseConversationPayload(payload: unknown): {
  scenario: ConversationScenario;
  messages: ConversationMessage[];
  level: CEFRLevel;
} {
  if (!payload || typeof payload !== "object") {
    throw new AIRouteError(400, "INVALID_PAYLOAD", "Invalid conversation payload");
  }

  const candidate = payload as { scenario?: unknown; messages?: unknown; level?: unknown };
  if (!candidate.scenario || typeof candidate.scenario !== "object") {
    throw new AIRouteError(400, "INVALID_SCENARIO", "Invalid conversation scenario");
  }

  const scenario = candidate.scenario as Partial<ConversationScenario>;
  const validScenario =
    cleanText(scenario.id, 80)
    && cleanText(scenario.title, 120)
    && cleanText(scenario.setting, 400)
    && cleanText(scenario.characterName, 60)
    && cleanText(scenario.characterRole, 100)
    && isStringArray(scenario.objectives, 6)
    && isStringArray(scenario.targetConcepts, 12)
    && isStringArray(scenario.suggestedReplies, 12);
  if (!validScenario) {
    throw new AIRouteError(400, "INVALID_SCENARIO", "Invalid conversation scenario");
  }

  if (!Array.isArray(candidate.messages) || candidate.messages.length === 0) {
    throw new AIRouteError(400, "INVALID_MESSAGES", "Invalid conversation messages");
  }

  const messages = candidate.messages.slice(-8).map((message): ConversationMessage => {
    if (!message || typeof message !== "object") {
      throw new AIRouteError(400, "INVALID_MESSAGES", "Invalid conversation messages");
    }
    const item = message as Partial<ConversationMessage>;
    const text = cleanText(item.text, 500);
    if ((item.role !== "character" && item.role !== "learner") || !text) {
      throw new AIRouteError(400, "INVALID_MESSAGES", "Invalid conversation messages");
    }
    return { id: cleanText(item.id, 100) || crypto.randomUUID(), role: item.role, text };
  });

  if (messages.at(-1)?.role !== "learner") {
    throw new AIRouteError(400, "INVALID_MESSAGES", "The last message must come from the learner");
  }

  const level = candidate.level;
  if (typeof level !== "string" || !CEFR_LEVELS.some((item) => item === level)) {
    throw new AIRouteError(400, "INVALID_LEVEL", "Invalid CEFR level");
  }

  return { scenario: scenario as ConversationScenario, messages, level: level as CEFRLevel };
}

async function complete(messages: ChatMessage[], maxTokens: number, model: string) {
  const apiKey = process.env.MAMMOUTH_API_KEY;
  if (!apiKey) {
    throw new AIRouteError(503, "MAMMOUTH_NOT_CONFIGURED", "Mammouth is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14_000);
  try {
    let response: Response;
    try {
      response = await fetch(MAMMOUTH_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.55,
          max_tokens: maxTokens,
          stream: false,
        }),
        signal: controller.signal,
        cache: "no-store",
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw new AIRouteError(504, "MAMMOUTH_TIMEOUT", "Mammouth request timed out");
      }
      throw new AIRouteError(502, "MAMMOUTH_UNREACHABLE", "Mammouth could not be reached");
    }

    if (response.status === 429) {
      throw new AIRouteError(429, "MAMMOUTH_RATE_LIMITED", "Mammouth rate limit reached");
    }
    if (response.status === 401 || response.status === 403) {
      throw new AIRouteError(503, "MAMMOUTH_AUTH_FAILED", "Mammouth credentials were rejected");
    }
    if (!response.ok) {
      throw new AIRouteError(502, "MAMMOUTH_BAD_GATEWAY", `Mammouth request failed (${response.status})`);
    }

    let data: MammouthResponse;
    try {
      data = (await response.json()) as MammouthResponse;
    } catch {
      throw new AIRouteError(502, "MAMMOUTH_INVALID_RESPONSE", "Mammouth returned invalid JSON");
    }
    const content = cleanText(data.choices?.[0]?.message?.content, 500);
    if (!content) {
      throw new AIRouteError(502, "MAMMOUTH_INVALID_RESPONSE", "Mammouth returned an empty response");
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function conversationTurn(payload: unknown) {
  const { scenario, messages, level } = parseConversationPayload(payload);
  const levelConfig = LEVEL_CONFIG[level];
  const model = resolveModel(levelConfig.modelTier);
  const system = [
    `You are ${scenario.characterName}, ${scenario.characterRole}, in a guided English-learning roleplay.`,
    `Setting: ${scenario.setting}. Objectives: ${scenario.objectives.join(", ")}.`,
    `Create natural opportunities to use these target concepts: ${scenario.targetConcepts.join(", ")}.`,
    `The learner's CEFR level is ${level}. ${levelConfig.guidance}`,
    "Keep the conversation moving. Do not explain, grade, use markdown, or over-correct small mistakes.",
  ].join(" ");
  const content = await complete([
    { role: "system", content: system },
    ...messages.map<ChatMessage>((message) => ({
      role: message.role === "character" ? "assistant" : "user",
      content: message.text,
    })),
  ], levelConfig.maxTokens, model);
  return { id: `mammouth-${crypto.randomUUID()}`, role: "character" as const, text: content };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_SIZE) {
    return errorResponse(413, "REQUEST_TOO_LARGE", "Request too large");
  }

  let body: AIRequest;
  try {
    body = JSON.parse(rawBody) as AIRequest;
  } catch {
    return errorResponse(400, "INVALID_JSON", "Invalid JSON body");
  }

  if (!body || typeof body !== "object") {
    return errorResponse(400, "INVALID_REQUEST", "Invalid request");
  }
  if (body.action !== "generateConversationTurn") {
    return errorResponse(400, "UNSUPPORTED_ACTION", "Unsupported action");
  }

  try {
    const data = await conversationTurn(body.payload);
    return Response.json({ data });
  } catch (error) {
    if (error instanceof AIRouteError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(500, "INTERNAL_ERROR", "Unexpected AI service error");
  }
}
