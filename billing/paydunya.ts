import { createHash, timingSafeEqual } from "node:crypto";
import { getPayDunyaConfig } from "./config";
import type { BillingCustomer } from "./repository";

interface PayDunyaResponse {
  response_code?: string;
  response_text?: string;
  token?: string;
  hash?: string;
  status?: string;
  invoice?: { token?: string; total_amount?: number | string };
  custom_data?: { billing_invoice_id?: string; transaction_reference?: string };
}

function apiBase(mode: "test" | "production") {
  return mode === "test" ? "https://app.paydunya.com/sandbox-api/v1" : "https://app.paydunya.com/api/v1";
}

function headers() {
  const config = getPayDunyaConfig();
  if (!config) throw new Error("PAYDUNYA_NOT_CONFIGURED");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "PAYDUNYA-MASTER-KEY": config.principalKey,
    "PAYDUNYA-PRIVATE-KEY": config.privateKey,
    "PAYDUNYA-TOKEN": config.token,
  };
}

function validHash(received: string | undefined) {
  const config = getPayDunyaConfig();
  if (!config || !received) return false;
  const expected = Buffer.from(createHash("sha512").update(config.principalKey).digest("hex"));
  const candidate = Buffer.from(received.toLowerCase());
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({})) as PayDunyaResponse;
  if (!response.ok) throw new Error(`PAYDUNYA_HTTP_${response.status}`);
  return data;
}

export async function initializePayDunya(input: { transactionReference: string; amount: number; description: string; customer: BillingCustomer; invoiceId: string; baseUrl: string }) {
  const config = getPayDunyaConfig();
  if (!config) throw new Error("PAYDUNYA_NOT_CONFIGURED");
  const response = await fetch(`${apiBase(config.mode)}/checkout-invoice/create`, {
    method: "POST",
    headers: headers(),
    cache: "no-store",
    body: JSON.stringify({
      invoice: {
        items: { item_0: { name: "Accès individuel Bibata", quantity: 1, unit_price: input.amount, total_price: input.amount, description: input.description } },
        customer: { name: input.customer.name, email: input.customer.email, phone: input.customer.phone },
        total_amount: input.amount,
        description: input.description,
      },
      store: { name: "Bibata", tagline: "Apprendre à son rythme", website_url: input.baseUrl },
      custom_data: { billing_invoice_id: input.invoiceId, transaction_reference: input.transactionReference },
      actions: { cancel_url: `${input.baseUrl}/?paiement=annule`, return_url: `${input.baseUrl}/?paiement=retour`, callback_url: `${input.baseUrl}/payment-verif` },
    }),
  });
  const result = await readResponse(response);
  if (result.response_code !== "00" || !result.token || !result.response_text?.startsWith("https://")) throw new Error("PAYDUNYA_INITIALIZATION_FAILED");
  return { token: result.token, paymentUrl: result.response_text, mode: config.mode };
}

export async function verifyPayDunya(invoiceToken: string) {
  const config = getPayDunyaConfig();
  if (!config) throw new Error("PAYDUNYA_NOT_CONFIGURED");
  const response = await fetch(`${apiBase(config.mode)}/checkout-invoice/confirm/${encodeURIComponent(invoiceToken)}`, { method: "GET", headers: headers(), cache: "no-store" });
  const result = await readResponse(response);
  if (result.response_code !== "00" || !validHash(result.hash)) throw new Error("PAYDUNYA_VERIFICATION_FAILED");
  return {
    status: result.status,
    amount: Number(result.invoice?.total_amount),
    token: result.invoice?.token ?? invoiceToken,
    invoiceId: result.custom_data?.billing_invoice_id,
  };
}

export function parsePayDunyaNotificationData(form: FormData) {
  const raw = form.get("data");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as PayDunyaResponse;
      if (validHash(parsed.hash)) return { token: parsed.invoice?.token, status: parsed.status };
    } catch {
      // PayDunya normally posts nested URL-encoded fields, handled below.
    }
  }
  const hash = form.get("data[hash]");
  const token = form.get("data[invoice][token]");
  const status = form.get("data[status]");
  if (typeof hash !== "string" || typeof token !== "string" || typeof status !== "string" || !validHash(hash)) return undefined;
  return { token, status };
}
