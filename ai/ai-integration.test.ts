import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { countCompletedConversationTurns } from "@/core/conversation";
import type { CEFRLevel, ConversationMessage, ConversationScenario, LearningPlan } from "@/types/learning";
import { conversationReplyFitsLevel, handleAIRequest } from "@/ai/route-handler";
import { AIProviderError, MammouthAIProvider } from "./provider";
import { concepts } from "@/data/curriculum";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.MAMMOUTH_API_KEY;
const modelEnvKeys = ["MAMMOUTH_MODEL_BEGINNER", "MAMMOUTH_MODEL_INTERMEDIATE", "MAMMOUTH_MODEL_ADVANCED", "MAMMOUTH_MODEL_PLANNER"] as const;
const originalModels = Object.fromEntries(modelEnvKeys.map((key) => [key, process.env[key]]));
const POST = (request: Request) => handleAIRequest(request, async () => ({ id: "test-user" }));

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
  headers: { "Content-Type": "application/json", "x-forwarded-for": `test-${requestSequence}` },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

let requestSequence = 0;

const validRequest = (level: CEFRLevel | string = "A1") => routeRequest({
  action: "generateConversationTurn",
  payload: { scenario: { ...scenario, id: `${scenario.id}-${requestSequence}` }, messages, level },
});

const generatedA2Plan = {
  title: "City & Music Mix",
  focus: "Gagner en autonomie à travers la musique et les sorties en ville.",
  missions: [
    { title: "Plan the Evening", eyebrow: "Choisir un moment", description: "Organise une sortie musicale.", interest: "music", conceptIds: ["are-you-free", "how-about", "sounds-good"], conversation: { title: "Une soirée musicale", setting: "Bibata organise un concert avec toi.", characterRole: "Amie", objectives: ["vérifier la disponibilité", "proposer une heure", "confirmer"], opening: "Are you free for a concert this Friday?" } },
    { title: "Find the Venue", eyebrow: "Se déplacer", description: "Rejoins le lieu du concert.", interest: "travel", conceptIds: ["take-the-bus", "turn-left", "how-long"], conversation: { title: "En route vers le concert", setting: "Bibata t’aide à trouver la salle.", characterRole: "Amie du quartier", objectives: ["choisir un transport", "suivre une direction", "demander la durée"], opening: "The venue is across town. How would you like to get there?" } },
    { title: "A Change of Plan", eyebrow: "S’adapter", description: "Réorganise la sortie après un imprévu.", interest: "music", conceptIds: ["how-about", "take-the-bus", "how-long"], conversation: { title: "Un imprévu", setting: "Le concert change d’adresse au dernier moment.", characterRole: "Amie", objectives: ["proposer une solution", "choisir le trajet", "vérifier le temps"], opening: "The venue has changed. How about taking the bus instead?" } },
  ],
};

beforeEach(() => {
  requestSequence += 1;
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
  test("enforces distinct CEFR limits instead of trusting the model label", () => {
    expect(conversationReplyFitsLevel("Hi! What is your name?", "A1")).toBe(true);
    expect(conversationReplyFitsLevel("Although the circumstances are somewhat ambiguous, what underlying assumption would you challenge?", "A1")).toBe(false);
    expect(conversationReplyFitsLevel("Oh, super ! Tu veux voir les gadgets ?", "A2")).toBe(false);
    expect(conversationReplyFitsLevel("Notwithstanding the apparent consensus, which underlying premise would you be most inclined to challenge?", "C2")).toBe(true);
  });

  test("rewrites a model reply that does not respect the selected level", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return Response.json({ choices: [{ message: { content: calls === 1 ? "Oh, super ! Tu veux voir les gadgets ?" : "Great! Do you want to see the gadgets?" } }] });
    }) as typeof fetch;

    const response = await POST(validRequest("A2"));
    const result = await response.json() as { data: ConversationMessage };

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
    expect(result.data.text).toBe("Great! Do you want to see the gadgets?");
  });

  test("requires an account before generating the next mission", async () => {
    const response = await handleAIRequest(routeRequest({ action: "generateNextMission", payload: {} }), async () => undefined);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "ACCOUNT_REQUIRED" });
  });

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

  test("validates a target only when Mammouth confirms coherent use", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    globalThis.fetch = (async () => Response.json({
      choices: [{ message: { content: JSON.stringify({
        reply: "That makes sense. What music do you like?",
        validTargets: ["I like"],
      }) } }],
    })) as typeof fetch;

    const response = await POST(routeRequest({
      action: "generateConversationTurn",
      payload: {
        scenario: { ...scenario, id: `${scenario.id}-semantic-${requestSequence}` },
        messages: [messages[0], { id: "learner-semantic", role: "learner", text: "I like music." }],
        level: "A1",
      },
    }));
    const result = await response.json() as { data: ConversationMessage };

    expect(response.status).toBe(200);
    expect(result.data.validatedConcepts).toEqual(["I like"]);
  });

  test("never validates a target that is absent from the learner message", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    globalThis.fetch = (async () => Response.json({
      choices: [{ message: { content: JSON.stringify({
        reply: "Nice to meet you, Sam!",
        validTargets: ["goodbye"],
      }) } }],
    })) as typeof fetch;

    const response = await POST(validRequest());
    const result = await response.json() as { data: ConversationMessage };

    expect(response.status).toBe(200);
    expect(result.data.validatedConcepts).toEqual([]);
  });

  test("asks Mammouth to reject copied, meaningless and off-topic uses", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    let systemPrompt = "";
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ role: string; content: string }> };
      systemPrompt = body.messages[0]?.content ?? "";
      return Response.json({ choices: [{ message: { content: JSON.stringify({ reply: "Nice to meet you!", validTargets: [] }) } }] });
    }) as typeof fetch;

    const response = await POST(validRequest());

    expect(response.status).toBe(200);
    expect(systemPrompt).toContain("coherent and relevant");
    expect(systemPrompt).toContain("Reject copied instructions");
    expect(systemPrompt).toContain("minor level-appropriate grammar");
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
    expect(mammouthBody.messages?.[0]?.content).toContain("CEFR C1");
    expect(mammouthBody.messages?.[0]?.content).toContain("Nuanced, precise language");
    expect(mammouthBody.messages?.[0]?.content).toContain("Reply only in English");
    expect(mammouthBody.messages?.[0]?.content).toContain("never narrate the scene");
    expect(mammouthBody.max_tokens).toBe(308);
    expect(mammouthBody.model).toBe("glm-5.2");
  });

  test("falls back to the intermediate model when advanced reasoning consumes the whole reply", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    const selectedModels: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { model: string };
      selectedModels.push(body.model);
      if (selectedModels.length === 1) {
        return Response.json({ choices: [{ finish_reason: "length", message: { content: null, reasoning_content: "Still reasoning about the answer" } }] });
      }
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: "That distinction is worth examining more closely." } }] });
    }) as typeof fetch;

    const response = await POST(validRequest("C2"));
    const result = await response.json() as { data: ConversationMessage };

    expect(response.status).toBe(200);
    expect(result.data.text).toBe("That distinction is worth examining more closely.");
    expect(selectedModels).toEqual(["glm-5.2", "mistral-medium-3.1"]);
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

  test("creates only the first mission of a personal learning thread", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    let mammouthBody: { model?: string; temperature?: number; messages?: Array<{ content: string }> } = {};
    globalThis.fetch = (async (_input, init) => {
      mammouthBody = JSON.parse(String(init?.body));
      return Response.json({ choices: [{ message: { content: JSON.stringify(generatedA2Plan) } }] });
    }) as typeof fetch;

    const response = await POST(routeRequest({ action: "generateLearningPlan", payload: { level: "A2", interests: ["music", "travel"], learnerSeed: "learner-123" } }));
    const result = await response.json() as { data: LearningPlan };

    expect(response.status).toBe(200);
    expect(result.data.level).toBe("A2");
    expect(result.data.missions).toHaveLength(1);
    expect(result.data.missions[0].conversation.characterName).toBe("Bibata");
    expect(mammouthBody.model).toBe("mistral-small-2603");
    expect(mammouthBody.temperature).toBe(0.72);
    expect(mammouthBody.messages?.[1]?.content).not.toContain("learner-123");
  });

  test("uses a non-reasoning planner for C2 and accepts Mammouth's output wrapper", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    let selectedModel = "";
    const wrappedPlan = {
      output: {
        title: "Beyond the Postcard",
        focus: "Explorer les récits de voyage avec précision et esprit critique.",
        mission: {
          title: "Question the Perfect Journey",
          theme: "Nuancer un récit de voyage",
          opening: "Notwithstanding its charm, do you think this account hides something important?",
        },
      },
    };
    globalThis.fetch = (async (_input, init) => {
      selectedModel = (JSON.parse(String(init?.body)) as { model: string }).model;
      return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(wrappedPlan) } }] });
    }) as typeof fetch;

    const response = await POST(routeRequest({ action: "generateLearningPlan", payload: { level: "C2", interests: ["travel"], learnerSeed: "c2-output-wrapper" } }));
    const result = await response.json() as { data: LearningPlan };

    expect(response.status).toBe(200);
    expect(selectedModel).toBe("mistral-medium-3.1");
    expect(result.data.level).toBe("C2");
    expect(result.data.title).toBe("Beyond the Postcard");
    expect(result.data.missions[0].title).toBe("Question the Perfect Journey");
  });

  test("deduplicates identical plan requests for five minutes", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    let mammouthCalls = 0;
    globalThis.fetch = (async () => {
      mammouthCalls += 1;
      return Response.json({ choices: [{ message: { content: JSON.stringify(generatedA2Plan) } }] });
    }) as typeof fetch;
    const body = { action: "generateLearningPlan", payload: { level: "A2", interests: ["music"], learnerSeed: "dedup-learner" } };

    const first = await POST(routeRequest(body));
    const second = await POST(routeRequest(body));
    const firstPlan = await first.json() as { data: LearningPlan };
    const secondPlan = await second.json() as { data: LearningPlan };

    expect(mammouthCalls).toBe(1);
    expect(second.headers.get("X-Bibata-AI-Cache")).toBe("hit");
    expect(secondPlan.data.id).toBe(firstPlan.data.id);
  });

  test("caps new AI work without charging cached retries", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    let mammouthCalls = 0;
    globalThis.fetch = (async () => {
      mammouthCalls += 1;
      return Response.json({ choices: [{ message: { content: JSON.stringify(generatedA2Plan) } }] });
    }) as typeof fetch;

    for (let index = 0; index < 20; index += 1) {
      const response = await POST(routeRequest({ action: "generateLearningPlan", payload: { level: "A2", interests: ["music"], learnerSeed: `budget-${index}` } }));
      expect(response.status).toBe(200);
    }
    const blocked = await POST(routeRequest({ action: "generateLearningPlan", payload: { level: "A2", interests: ["music"], learnerSeed: "budget-blocked" } }));
    const cached = await POST(routeRequest({ action: "generateLearningPlan", payload: { level: "A2", interests: ["music"], learnerSeed: "budget-0" } }));

    expect(blocked.status).toBe(429);
    expect((await blocked.json() as { code: string }).code).toBe("AI_BUDGET_REACHED");
    expect(blocked.headers.get("Retry-After")).toBe("600");
    expect(cached.status).toBe(200);
    expect(cached.headers.get("X-Bibata-AI-Cache")).toBe("hit");
    expect(mammouthCalls).toBe(20);
  });

  test("accepts harmless JSON key variations from Mammouth", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    const wrappedPlan = {
      result: {
        pathTitle: "A Curious City",
        thread: "Explorer la ville à travers les centres d’intérêt de l’apprenant.",
        firstMission: {
          missionTitle: "Choose Tonight's Plan",
          topic: "Une sortie spontanée",
          initialMessage: "Are you free to try something new tonight?",
        },
      },
    };
    globalThis.fetch = (async () => Response.json({ choices: [{ message: { content: JSON.stringify(wrappedPlan) } }] })) as typeof fetch;

    const response = await POST(routeRequest({ action: "generateLearningPlan", payload: { level: "A2", interests: ["music"], learnerSeed: "learner-aliases" } }));
    const result = await response.json() as { data: LearningPlan };

    expect(response.status).toBe(200);
    expect(result.data.title).toBe("A Curious City");
    expect(result.data.missions[0].title).toBe("Choose Tonight's Plan");
    expect(result.data.missions[0].conversation.opening).toBe("Are you free to try something new tonight?");
  });

  test("recovers the useful fields when Mammouth truncates extra JSON", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    const truncatedPlan = `\`\`\`json
{
  "thread": {
    "title": "Echoes of Change",
    "focus": "Relier les goûts passés et présents."
  },
  "mission": {
    "title": "The Soundtrack of Then and Now",
    "theme": "Évoquer ses goûts passés",
    "opening": "What song did you use to love?",
    "objectives": ["Use used to",`;
    globalThis.fetch = (async () => Response.json({ choices: [{ message: { content: truncatedPlan } }] })) as typeof fetch;

    const response = await POST(routeRequest({ action: "generateLearningPlan", payload: { level: "B1", interests: ["music"], learnerSeed: "learner-truncated" } }));
    const result = await response.json() as { data: LearningPlan };

    expect(response.status).toBe(200);
    expect(result.data.title).toBe("Echoes of Change");
    expect(result.data.focus).toBe("Relier les goûts passés et présents.");
    expect(result.data.missions[0].title).toBe("The Soundtrack of Then and Now");
    expect(result.data.missions[0].conversation.opening).toBe("What song did you use to love?");
  });

  test("retries once when Mammouth returns an empty plan", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return calls === 1
        ? Response.json({ choices: [] })
        : Response.json({ choices: [{ message: { content: JSON.stringify(generatedA2Plan) } }] });
    }) as typeof fetch;

    const response = await POST(routeRequest({ action: "generateLearningPlan", payload: { level: "A2", interests: ["music"], learnerSeed: "learner-retry" } }));
    const result = await response.json() as { data: LearningPlan };

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
    expect(result.data.missions).toHaveLength(1);
  });

  test("generates the next mission without overlapping the previous concept group", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    let mammouthCalls = 0;
    globalThis.fetch = (async () => {
      mammouthCalls += 1;
      const content = mammouthCalls === 1
        ? generatedA2Plan
        : { title: "Meet the Artist", theme: "Une rencontre musicale", opening: "Which song would you ask the artist about?" };
      return Response.json({ choices: [{ message: { content: JSON.stringify(content) } }] });
    }) as typeof fetch;

    const planResponse = await POST(routeRequest({ action: "generateLearningPlan", payload: { level: "A2", interests: ["music", "travel"], learnerSeed: "learner-next-123" } }));
    const plan = (await planResponse.json() as { data: LearningPlan }).data;

    const response = await POST(routeRequest({ action: "generateNextMission", payload: {
      level: "A2",
      interests: ["music", "travel"],
      learnerSeed: "learner-next-123",
      planId: plan.id,
      focus: plan.focus,
      nextOrder: 2,
      previousTitles: [plan.missions[0].title],
    } }));
    const result = await response.json() as { data: LearningPlan["missions"][number] };

    expect(response.status).toBe(200);
    expect(result.data.id).toBe(`${plan.id}-mission-2`);
    expect(result.data.order).toBe(2);
    expect(result.data.title).toBe("Meet the Artist");
    expect(result.data.conceptIds).toHaveLength(3);
    expect(result.data.conceptIds.filter((id) => plan.missions[0].conceptIds.includes(id))).toHaveLength(0);
  });

  test("excludes assimilated concepts from the next mission", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    globalThis.fetch = (async () => Response.json({ choices: [{ message: { content: JSON.stringify({
      title: "A Fresh Plan", theme: "De nouvelles formulations", opening: "What would you like to plan today?",
    }) } }] })) as typeof fetch;
    const a2Ids = scenario.targetConcepts;
    void a2Ids;
    const response = await POST(routeRequest({ action: "generateNextMission", payload: {
      level: "A2", interests: ["music"], learnerSeed: "exclude-known", planId: "plan-exclude-known",
      focus: "Continuer sans répétition", nextOrder: 2, previousTitles: ["First"],
      excludedConceptIds: ["are-you-free", "how-about", "sounds-good", "take-the-bus"],
    } }));
    const result = await response.json() as { data: LearningPlan["missions"][number] };

    expect(response.status).toBe(200);
    expect(result.data.conceptIds).toHaveLength(3);
    expect(result.data.conceptIds.every((id) => !["are-you-free", "how-about", "sounds-good", "take-the-bus"].includes(id))).toBe(true);
    expect(result.data.conceptIds).not.toContain("are-you-free");
  });

  test("continues with a consolidation mission when every concept is assimilated", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    let systemPrompt = "";
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
      systemPrompt = body.messages[0]?.content ?? "";
      return Response.json({ choices: [{ message: { content: JSON.stringify({
        title: "Use It in a New Place", theme: "Réagir dans une nouvelle situation", opening: "How would you handle this plan today?",
      }) } }] });
    }) as typeof fetch;
    const response = await POST(routeRequest({ action: "generateNextMission", payload: {
      level: "A2", interests: ["travel"], learnerSeed: "all-known", planId: "plan-all-known",
      focus: "Pratiquer librement", nextOrder: 4, previousTitles: ["One", "Two", "Three"],
      excludedConceptIds: concepts.filter((concept) => concept.level === "A2").map((concept) => concept.id),
    } }));
    const result = await response.json() as { data: LearningPlan["missions"][number] };

    expect(response.status).toBe(200);
    expect(result.data.kind).toBe("consolidation");
    expect(result.data.conceptIds).toHaveLength(3);
    expect(systemPrompt).toContain("consolidation mission");
  });

  test("rejects a generated plan with an incomplete conversation", async () => {
    process.env.MAMMOUTH_API_KEY = "test-key";
    const invalidPlan = structuredClone(generatedA2Plan);
    invalidPlan.missions[0].conversation.opening = "";
    globalThis.fetch = (async () => Response.json({ choices: [{ message: { content: JSON.stringify(invalidPlan) } }] })) as typeof fetch;

    const response = await POST(routeRequest({ action: "generateLearningPlan", payload: { level: "A2", interests: ["music"], learnerSeed: "learner-456" } }));
    const result = await response.json() as { code: string };

    expect(response.status).toBe(502);
    expect(result.code).toBe("MAMMOUTH_INVALID_PLAN");
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

  test("accepts only a complete personal learning plan", async () => {
    const plan: LearningPlan = {
      id: "plan-1", level: "A2", title: "City & Music Mix", focus: "Un parcours personnel", createdAt: 1, learnerSeed: "learner-123",
      missions: generatedA2Plan.missions.slice(0, 1).map((mission, index) => ({ ...mission, id: `mission-${index + 1}`, order: index + 1, conversation: { ...mission.conversation, characterName: "Bibata" } })),
    };
    globalThis.fetch = (async () => Response.json({ data: plan })) as typeof fetch;

    await expect(new MammouthAIProvider().generateLearningPlan("A2", ["music"], "learner-123"))
      .resolves.toEqual(plan);
  });

  test("requests one following mission from the current thread", async () => {
    const plan: LearningPlan = {
      id: "plan-1", level: "A2", title: "City & Music Mix", focus: "Un parcours personnel", createdAt: 1, learnerSeed: "learner-123",
      missions: generatedA2Plan.missions.slice(0, 1).map((mission) => ({ ...mission, id: "plan-1-mission-1", order: 1, conversation: { ...mission.conversation, characterName: "Bibata" } })),
    };
    const nextMission = { ...plan.missions[0], id: "plan-1-mission-2", order: 2, title: "Meet the Artist" };
    let requestBody: { action?: string; payload?: { nextOrder?: number; previousTitles?: string[] } } = {};
    globalThis.fetch = (async (_input, init) => {
      requestBody = JSON.parse(String(init?.body));
      return Response.json({ data: nextMission });
    }) as typeof fetch;

    await expect(new MammouthAIProvider().generateNextMission(plan, ["music"]))
      .resolves.toEqual(nextMission);
    expect(requestBody.action).toBe("generateNextMission");
    expect(requestBody.payload?.nextOrder).toBe(2);
    expect(requestBody.payload?.previousTitles).toEqual(["Plan the Evening"]);
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
