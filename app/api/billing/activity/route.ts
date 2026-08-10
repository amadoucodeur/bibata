import { getBillingStoreConfig } from "@/billing/config";
import { findCustomerByAuthUserId, recordActivity } from "@/billing/repository";
import { BillingStoreError } from "@/billing/supabase";
import { getAuthenticatedUser } from "@/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!getBillingStoreConfig()) return Response.json({ recorded: false, configured: false }, { status: 503 });
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ recorded: false, accountRequired: true }, { status: 401 });
    const customer = await findCustomerByAuthUserId(user.id);
    if (!customer) return Response.json({ recorded: false, accountRequired: true }, { status: 401 });
    const body = await request.json() as { missionId?: unknown };
    const missionId = typeof body.missionId === "string" ? body.missionId.trim() : "";
    if (!missionId || missionId.length > 160) return Response.json({ error: "Mission invalide." }, { status: 400 });
    await recordActivity(customer.id, missionId);
    return Response.json({ recorded: true });
  } catch (error) {
    if (error instanceof BillingStoreError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Billing activity failed", error);
    return Response.json({ error: "L’activité n’a pas pu être enregistrée." }, { status: 500 });
  }
}
