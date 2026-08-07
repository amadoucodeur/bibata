import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { countCompletedConversationTurns } from "@/core/conversation";
import type { CEFRLevel, ConversationMessage, ConversationScenario } from "@/types/learning";
import { POST } from "@/app/api/ai/route";
import { AIProviderError, MammouthAIProvider } from "./provider";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.MAMMOUTH_API_KEY;
const modelEnvKeys = ["MAMMOUTH_MODEL_BEGINNER", "MAMMOUTH_MODEL_INTERMEDIATE", "MAMMOUTH_MODEL_ADVANCED"] as const;
const originalModels = Object.fromEntries(modelEnvKeys.map((key) => [key, process.env[key]]));

const scenario: ConversationScenario = {
  id: "test-conversation",
  title: "Meet Bibata",
  setting: "A small party",
  characterName: "Bibata",
  characterRole: "a friendly guest",
  objectives: ["Introduce yourself", "Share an interest", "Say goodbye"],
  targetConcepts: ["hello", "I like", "goodbye"],
  suggestedReplies: ["Hi, I’m Sam.", "I like music.", "Goodbye!"],
};

const messages: ConversationMessage[] = [
  { id: "opening", role: "character", text: "Hi! What’s your name?" },
  { id: "learner-1", role: "learner", text: "Hi, I’m Sam." },
];

const routeRequest = (body: unknown) => new Request("http://localhost/api/ai", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

const validRequest = (level: CEFRLevel | string = "A1") => routeRequest({
  action: "generateConversationTurn",
  payload: { scenario, messages, level },
});

beforeEach(() => {
  for (const key of modelEnvKeys) delete process.env[key];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.MAMMOUTH_API_KEY;
  else process.env.MAMMOUTH_API_KEY = originalApiKey;
  for (const key of modelEnvKeys) {
    const value = originalModels[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Mammouth route", () => {
  test("returns a validated character reply", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    globalThis.fetch = (async () => Response.json({
      choices: [{ message: { content: "Nice to meet you, Sam!" } }],
    })) as typeof fetch;

    const response = await POST(validRequest());
    const result = await response.json() as { data: ConversationMessage };

    expect(response.status).toBe(200);
    expect(result.data.role).toBe("character");
    expect(result.data.text).toBe("Nice to meet you, Sam!");
  });

  test("rejects malformed requests before calling Mammouth", async () => {
    const response = await POST(routeRequest("{"));
    const result = await response.json() as { code: string };

    expect(response.status).toBe(400);
    expect(result.code).toBe("INVALID_JSON");
  });

  test("reports missing configuration", async () => {
    delete process.env.MAMMOUTH_API_KEY;
    const response = await POST(validRequest());
    const result = await response.json() as { code: string };

    expect(response.status).toBe(503);
    expect(result.code).toBe("MAMMOUTH_NOT_CONFIGURED");
  });

  test("preserves Mammouth rate limiting", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    globalThis.fetch = (async () => new Response(null, { status: 429 })) as typeof fetch;

    const response = await POST(validRequest());
    const result = await response.json() as { code: string };

    expect(response.status).toBe(429);
    expect(result.code).toBe("MAMMOUTH_RATE_LIMITED");
  });

  test("reports timeouts separately", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    globalThis.fetch = (async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    }) as typeof fetch;

    const response = await POST(validRequest());
    const result = await response.json() as { code: string };

    expect(response.status).toBe(504);
    expect(result.code).toBe("MAMMOUTH_TIMEOUT");
  });

  test("rejects invalid Mammouth responses", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    globalThis.fetch = (async () => Response.json({ choices: [] })) as typeof fetch;

    const response = await POST(validRequest());
    const result = await response.json() as { code: string };

    expect(response.status).toBe(502);
    expect(result.code).toBe("MAMMOUTH_INVALID_RESPONSE");
  });

  test("rejects an unknown CEFR level", async () => {
    const response = await POST(validRequest("A3"));
    const result = await response.json() as { code: string };

    expect(response.status).toBe(400);
    expect(result.code).toBe("INVALID_LEVEL");
  });

  test("adapts the prompt and response budget to an advanced level", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    let mammouthBody: { model?: string; messages?: Array<{ role: string; content: string }>; max_tokens?: number } = {};
    globalThis.fetch = (async (_input, init) => {
      mammouthBody = JSON.parse(String(init?.body));
      return Response.json({ choices: [{ message: { content: "What perspective led you to that conclusion?" } }] });
    }) as typeof fetch;

    const response = await POST(validRequest("C1"));

    expect(response.status).toBe(200);
    expect(mammouthBody.messages?.[0]?.content).toContain("CEFR level is C1");
    expect(mammouthBody.messages?.[0]?.content).toContain("nuanced, precise language");
    expect(mammouthBody.max_tokens).toBe(220);
    expect(mammouthBody.model).toBe("glm-5.2");
  });

  test("selects a model tier proportional to the CEFR level", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    const selectedModels: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { model: string };
      selectedModels.push(body.model);
      return Response.json({ choices: [{ message: { content: "Hello!" } }] });
    }) as typeof fetch;

    await POST(validRequest("A2"));
    await POST(validRequest("B2"));
    await POST(validRequest("C2"));

    expect(selectedModels).toEqual([
      "mistral-small-2603",
      "mistral-medium-3.1",
      "glm-5.2",
    ]);
  });

  test("allows each model tier to be overridden from the environment", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    process.env.MAMMOUTH_MODEL_ADVANCED = "custom-advanced-model";
    let selectedModel = "";
    globalThis.fetch = (async (_input, init) => {
      selectedModel = (JSON.parse(String(init?.body)) as { model: string }).model;
      return Response.json({ choices: [{ message: { content: "Hello!" } }] });
    }) as typeof fetch;

    const response = await POST(validRequest("C1"));

    expect(response.status).toBe(200);
    expect(selectedModel).toBe("custom-advanced-model");
  });
});

describe("Mammouth provider", () => {
  test("accepts only a complete character message", async () => {
    globalThis.fetch = (async () => Response.json({
      data: { id: "reply-1", role: "character", text: "Nice to meet you!" },
    })) as typeof fetch;

    await expect(new MammouthAIProvider().generateConversationTurn(scenario, messages, "A1"))
      .resolves.toEqual({ id: "reply-1", role: "character", text: "Nice to meet you!" });
  });

  test("keeps the API error code for the interface", async () => {
    globalThis.fetch = (async () => Response.json(
      { code: "MAMMOUTH_RATE_LIMITED", error: "Wait" },
      { status: 429 },
    )) as typeof fetch;

    try {
      await new MammouthAIProvider().generateConversationTurn(scenario, messages, "A1");
      throw new Error("Expected the provider to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderError);
      expect((error as AIProviderError).code).toBe("MAMMOUTH_RATE_LIMITED");
      expect((error as AIProviderError).status).toBe(429);
    }
  });

  test("rejects a successful response with invalid data", async () => {
    globalThis.fetch = (async () => Response.json({ data: { role: "character", text: "" } })) as typeof fetch;

    await expect(new MammouthAIProvider().generateConversationTurn(scenario, messages, "A1"))
      .rejects.toMatchObject({ code: "INVALID_API_RESPONSE", status: 502 });
  });
});

describe("conversation progression", () => {
  test("counts only replies successfully received from the character", () => {
    expect(countCompletedConversationTurns(messages)).toBe(0);
    expect(countCompletedConversationTurns([
      ...messages,
      { id: "reply-1", role: "character", text: "Nice to meet you!" },
    ])).toBe(1);
  });
});
