import { deleteLearningState, pullLearningState, pushLearningState } from "@/storage/cloud-repository";
import { sanitizePersistedState } from "@/storage/state-validation";
import { getAuthenticatedUser } from "@/supabase/server";
import { BillingStoreError } from "@/billing/supabase";

export const runtime = "nodejs";
const MAX_SYNC_BODY_SIZE = 750_000;

function errorResponse(error: unknown) {
  if (error instanceof BillingStoreError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
  console.error("Learning sync failed", error);
  return Response.json({ error: "La synchronisation est momentanément indisponible." }, { status: 500 });
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ authenticated: false }, { status: 401 });
    return Response.json({ authenticated: true, state: await pullLearningState(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ authenticated: false }, { status: 401 });
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_SYNC_BODY_SIZE) return Response.json({ error: "Synchronisation trop volumineuse." }, { status: 413 });
    const raw = await request.text();
    if (raw.length > MAX_SYNC_BODY_SIZE) return Response.json({ error: "Synchronisation trop volumineuse." }, { status: 413 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Données de synchronisation invalides." }, { status: 400 });
    }
    const state = sanitizePersistedState(parsed);
    await pushLearningState(user.id, state);
    return Response.json({ synchronized: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ authenticated: false }, { status: 401 });
    await deleteLearningState(user.id);
    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
