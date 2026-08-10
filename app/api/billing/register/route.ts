import { getBillingStoreConfig, getPayDunyaConfig } from "@/billing/config";
import { periodKeyFor } from "@/billing/domain";
import { recordActivity, registerCustomer } from "@/billing/repository";
import { BillingStoreError } from "@/billing/supabase";
import { getAuthenticatedUser } from "@/supabase/server";

export const runtime = "nodejs";

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(request: Request) {
  if (!getBillingStoreConfig()) return Response.json({ configured: false, error: "La facturation serveur n’est pas encore configurée." }, { status: 503 });
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: "Connecte-toi avec Google pour activer la facturation." }, { status: 401 });
    const body = await request.json() as { phone?: unknown; activeMissionId?: unknown };
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const phoneDigits = phone.replace(/\D/g, "");
    const validIvoryCoastPhone = phoneDigits.length === 10 || (phoneDigits.length === 13 && phoneDigits.startsWith("225"));
    if (!validEmail(user.email) || !validIvoryCoastPhone) {
      return Response.json({ error: "Vérifie ton numéro Mobile Money." }, { status: 400 });
    }
    const customer = await registerCustomer({ authUserId: user.id, name: user.name, email: user.email, phone });
    if (typeof body.activeMissionId === "string" && body.activeMissionId.trim()) await recordActivity(customer.id, body.activeMissionId);
    return Response.json({ configured: true, paymentConfigured: Boolean(getPayDunyaConfig()), account: { name: customer.name, email: customer.email, phone: customer.phone }, currentPeriod: periodKeyFor(new Date()) });
  } catch (error) {
    if (error instanceof BillingStoreError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Billing registration failed", error);
    return Response.json({ error: "Le compte de facturation n’a pas pu être créé." }, { status: 500 });
  }
}
