import { randomUUID } from "node:crypto";
import { getPaymentBaseUrl, getPayDunyaConfig } from "@/billing/config";
import { MONTHLY_PRICE_XOF, periodLabel } from "@/billing/domain";
import { initializePayDunya } from "@/billing/paydunya";
import { activatePayDunyaTransaction, createTransaction, findCustomerByAuthUserId, getInvoiceForCustomer, markInvoicePending } from "@/billing/repository";
import { BillingStoreError } from "@/billing/supabase";
import { getAuthenticatedUser } from "@/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payDunya = getPayDunyaConfig();
  if (!payDunya) return Response.json({ error: "Le paiement PayDunya n’est pas encore configuré." }, { status: 503 });
  const baseUrl = getPaymentBaseUrl(request.url);
  const paymentOrigin = new URL(baseUrl);
  if (payDunya.mode === "production" && (paymentOrigin.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(paymentOrigin.hostname))) {
    return Response.json({ error: "Définis APP_BASE_URL avec l’adresse HTTPS publique de Bibata avant d’utiliser les clés PayDunya de production." }, { status: 503 });
  }
  try {
    const user = await getAuthenticatedUser();
    if (!user) return Response.json({ error: "Connexion Google requise." }, { status: 401 });
    const customer = await findCustomerByAuthUserId(user.id);
    if (!customer) return Response.json({ error: "Compte de facturation requis." }, { status: 401 });
    const body = await request.json() as { invoiceId?: unknown };
    const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId : "";
    const invoice = await getInvoiceForCustomer(invoiceId, customer.id);
    if (!invoice) return Response.json({ error: "Facture introuvable." }, { status: 404 });
    if (invoice.status === "paid") return Response.json({ error: "Cette facture est déjà réglée." }, { status: 409 });
    if (invoice.amount !== MONTHLY_PRICE_XOF || invoice.currency !== "XOF") return Response.json({ error: "Montant de facture invalide." }, { status: 409 });
    const transactionReference = `BIB-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await createTransaction(invoice.id, transactionReference);
    const checkout = await initializePayDunya({ transactionReference, amount: MONTHLY_PRICE_XOF, description: `Bibata individuel - ${periodLabel(invoice.period_start.slice(0, 7))}`, customer, invoiceId: invoice.id, baseUrl });
    await Promise.all([activatePayDunyaTransaction(transactionReference, checkout.token, checkout.paymentUrl), markInvoicePending(invoice.id)]);
    return Response.json({ paymentUrl: checkout.paymentUrl });
  } catch (error) {
    if (error instanceof BillingStoreError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Billing checkout failed", error);
    return Response.json({ error: "Le paiement n’a pas pu être ouvert. Réessaie dans un instant." }, { status: 502 });
  }
}
