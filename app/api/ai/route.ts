import type { ConversationMessage, ConversationScenario, Exercise } from "@/types/learning";

const MAMMOUTH_URL = "https://api.mammouth.ai/v1/chat/completions";
const DEFAULT_MODEL = "mistral-small-2603";
const MAX_BODY_SIZE = 32_000;

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

interface MammouthResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface AIRequest {
  action?: string;
  payload?: Record<string, unknown>;
}

const asStringArray = (value: unknown, limit = 12) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").slice(0, limit)
    : [];

const cleanText = (value: unknown, maxLength = 2_000) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const extractJson = <T,>(content: string): T => {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? content;
  const start = Math.min(
    ...[source.indexOf("{"), source.indexOf("[")].filter((index) => index >= 0),
  );
  if (!Number.isFinite(start)) throw new Error("No JSON found");
  const opening = source[start];
  const end = opening === "[" ? source.lastIndexOf("]") : source.lastIndexOf("}");
  return JSON.parse(source.slice(start, end + 1)) as T;
};

async function complete(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }) {
  const apiKey = process.env.MAMMOUTH_API_KEY;
  if (!apiKey) throw new Error("Mammouth is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14_000);
  try {
    const response = await fetch(MAMMOUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MAMMOUTH_MODEL ?? DEFAULT_MODEL,
        messages,
        temperature: options?.temperature ?? 0.55,
        max_tokens: options?.maxTokens ?? 180,
        stream: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Mammouth request failed (${response.status})`);
    const data = (await response.json()) as MammouthResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("Mammouth returned an empty response");
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function conversationTurn(payload: Record<string, unknown>) {
  const scenario = payload.scenario as Partial<ConversationScenario> | undefined;
  const rawMessages = Array.isArray(payload.messages) ? payload.messages : [];
  const messages = rawMessages
    .filter((message): message is ConversationMessage => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Partial<ConversationMessage>;
      return (candidate.role === "character" || candidate.role === "learner") && typeof candidate.text === "string";
    })
    .slice(-8);
  const characterName = cleanText(scenario?.characterName, 60) || "the character";
  const characterRole = cleanText(scenario?.characterRole, 100);
  const setting = cleanText(scenario?.setting, 400);
  const objectives = asStringArray(scenario?.objectives, 6).join(", ");
  const targetConcepts = asStringArray(scenario?.targetConcepts, 12).join(", ");
  const system = [
    `You are ${characterName}, ${characterRole}, in a guided English-learning roleplay.`,
    `Setting: ${setting}. Objectives: ${objectives}.`,
    `Create natural opportunities to use these target concepts: ${targetConcepts}.`,
    "The learner is A1. Reply only as the character, in simple English, using at most 18 words.",
    "Keep the conversation moving. Do not explain, grade, use markdown, or over-correct small mistakes.",
  ].join(" ");
  const content = await complete([
    { role: "system", content: system },
    ...messages.map<ChatMessage>((message) => ({
      role: message.role === "character" ? "assistant" : "user",
      content: cleanText(message.text, 500),
    })),
  ]);
  return { id: `mammouth-${crypto.randomUUID()}`, role: "character" as const, text: content };
}

async function generateContext(payload: Record<string, unknown>) {
  const concepts = asStringArray(payload.conceptIds);
  return complete([
    { role: "system", content: "You create one short, natural A1 English example followed by its French translation. No markdown." },
    { role: "user", content: `Use these concepts naturally: ${concepts.join(", ")}.` },
  ]);
}

async function evaluateFreeAnswer(payload: Record<string, unknown>) {
  const answer = cleanText(payload.answer, 800);
  const expectedMeaning = cleanText(payload.expectedMeaning, 800);
  const content = await complete([
    { role: "system", content: "Evaluate an A1 English answer kindly. Return only JSON: {\"accepted\":boolean,\"feedback\":\"short feedback in French\"}. Accept understandable answers despite small mistakes." },
    { role: "user", content: `Expected meaning: ${expectedMeaning}\nLearner answer: ${answer}` },
  ], { temperature: 0.2, maxTokens: 100 });
  const result = extractJson<{ accepted?: unknown; feedback?: unknown }>(content);
  return { accepted: result.accepted === true, feedback: cleanText(result.feedback, 240) || "Continue comme ça." };
}

async function generateCustomMission(payload: Record<string, unknown>) {
  const interest = cleanText(payload.interest, 100);
  const level = cleanText(payload.level, 10);
  const content = await complete([
    { role: "system", content: "Create a short language-learning mission. Return only JSON: {\"title\":\"short English title\",\"description\":\"one short French sentence\"}." },
    { role: "user", content: `Interest: ${interest}. CEFR level: ${level}.` },
  ], { temperature: 0.7, maxTokens: 100 });
  const result = extractJson<{ title?: unknown; description?: unknown }>(content);
  return { title: cleanText(result.title, 80), description: cleanText(result.description, 180) };
}

async function generateExercise(payload: Record<string, unknown>): Promise<Exercise[]> {
  const conceptIds = asStringArray(payload.conceptIds, 6);
  const content = await complete([
    { role: "system", content: "Create one deterministic A1 multiple-choice English exercise. Return only a JSON array matching: [{\"id\":string,\"type\":\"multiple_choice\",\"concepts\":string[],\"prompt\":string,\"difficulty\":number,\"payload\":{\"choices\":string[],\"answer\":string},\"evaluationMode\":\"local\"}]. The answer must exactly match one choice." },
    { role: "user", content: `Concept identifiers: ${conceptIds.join(", ")}.` },
  ], { temperature: 0.45, maxTokens: 280 });
  const result = extractJson<Exercise[]>(content);
  return Array.isArray(result) ? result.slice(0, 3) : [];
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_SIZE) return Response.json({ error: "Request too large" }, { status: 413 });
    const body = JSON.parse(rawBody) as AIRequest;
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
    let data: unknown;
    switch (body.action) {
      case "generateConversationTurn": data = await conversationTurn(payload); break;
      case "generateContext": data = await generateContext(payload); break;
      case "evaluateFreeAnswer": data = await evaluateFreeAnswer(payload); break;
      case "generateCustomMission": data = await generateCustomMission(payload); break;
      case "generateExercise": data = await generateExercise(payload); break;
      default: return Response.json({ error: "Unsupported action" }, { status: 400 });
    }
    return Response.json({ data });
  } catch {
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }
}
