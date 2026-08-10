import { getBillingStoreConfig, getPayDunyaConfig, getSupabaseAuthConfig } from "@/billing/config";
import { MONTHLY_PRICE_XOF, periodKeyFor } from "@/billing/domain";
import { checkBillingSchema, findCustomerByAuthUserId, hasActivity, listInvoices } from "@/billing/repository";
import { BillingStoreError } from "@/billing/supabase";
import { getAuthenticatedUser } from "@/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  if (!getBillingStoreConfig()) return Response.json({ configured: false, authConfigured: Boolean(getSupabaseAuthConfig()), paymentConfigured: Boolean(getPayDunyaConfig()), priceXof: MONTHLY_PRICE_XOF });
  try {
    await checkBillingSchema();
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ configured: true, authenticated: false, paymentConfigured: Boolean(getPayDunyaConfig()), priceXof: MONTHLY_PRICE_XOF, account: null, invoices: [], currentMonthActive: false });
    const customer = await findCustomerByAuthUserId(user.id);
    if (!customer) return Response.json({ configured: true, authenticated: true, authUser: user, paymentConfigured: Boolean(getPayDunyaConfig()), priceXof: MONTHLY_PRICE_XOF, account: null, invoices: [], currentMonthActive: false });
    const [invoices, currentMonthActive] = await Promise.all([listInvoices(customer.id), hasActivity(customer.id)]);
    return Response.json({ configured: true, authenticated: true, authUser: user, paymentConfigured: Boolean(getPayDunyaConfig()), priceXof: MONTHLY_PRICE_XOF, account: { name: customer.name, email: customer.email, phone: customer.phone }, invoices, currentMonthActive, currentPeriod: periodKeyFor(new Date()) });
  } catch (error) {
    if (error instanceof BillingStoreError && error.code === "BILLING_SCHEMA_MISSING") return Response.json({ configured: false, authConfigured: Boolean(getSupabaseAuthConfig()), paymentConfigured: Boolean(getPayDunyaConfig()), migrationRequired: true, priceXof: MONTHLY_PRICE_XOF });
    if (error instanceof BillingStoreError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Billing status failed", error);
    return Response.json({ error: "La facturation est momentanément indisponible." }, { status: 500 });
  }
}
