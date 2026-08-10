import { createHash } from "node:crypto";
import { effectiveInvoiceStatus, invoiceDates, MONTHLY_PRICE_XOF, periodKeyFor, type BillingInvoice } from "./domain";
import { encodeFilter, supabaseRequest } from "./supabase";

export interface BillingCustomer {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  phone: string;
}

interface AccountRow { id: string; user_id: string; display_name: string; email: string; mobile_phone: string }
interface UsageRow { account_id: string; period_start: string; source_id: string; occurred_at: string }
interface InvoiceRow { id: string; account_id: string; period_start: string; amount: number; currency: "XOF"; status: "open" | "pending" | "paid" | "void"; issued_at: string; due_at: string; grace_ends_at: string; paid_at: string | null }
interface TransactionRow { id: string; invoice_id: string; internal_reference: string; provider_token: string | null; status: string; checkout_url: string | null }

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "").replace(/^00/, "+");
const periodStartFor = (date: Date) => `${periodKeyFor(date)}-01`;

function toCustomer(row: AccountRow): BillingCustomer {
  return { id: row.id, authUserId: row.user_id, name: row.display_name, email: row.email, phone: row.mobile_phone };
}

export async function checkBillingSchema() {
  await supabaseRequest<AccountRow[]>("billing_accounts?select=id&limit=0");
}

export async function findCustomerByAuthUserId(authUserId: string) {
  const rows = await supabaseRequest<AccountRow[]>(`billing_accounts?user_id=eq.${encodeFilter(authUserId)}&select=id,user_id,display_name,email,mobile_phone&limit=1`);
  return rows[0] ? toCustomer(rows[0]) : undefined;
}

export async function registerCustomer(input: { authUserId: string; name: string; email: string; phone: string }) {
  const rows = await supabaseRequest<AccountRow[]>("billing_accounts?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ user_id: input.authUserId, display_name: input.name.trim().slice(0, 80), email: normalizeEmail(input.email).slice(0, 160), mobile_phone: normalizePhone(input.phone).slice(0, 24) }),
  });
  if (!rows[0]) throw new Error("BILLING_ACCOUNT_NOT_CREATED");
  return toCustomer(rows[0]);
}

export async function recordActivity(accountId: string, missionId: string, occurredAt = new Date()) {
  const row: UsageRow = { account_id: accountId, period_start: periodStartFor(occurredAt), source_id: missionId.slice(0, 160), occurred_at: occurredAt.toISOString() };
  await supabaseRequest("billing_usage_events?on_conflict=account_id,event_type,source_id,period_start", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ ...row, event_type: "mission_completed" }),
  });
}

export async function hasActivity(accountId: string, periodKey = periodKeyFor(new Date())) {
  const rows = await supabaseRequest<UsageRow[]>(`billing_usage_events?account_id=eq.${encodeFilter(accountId)}&period_start=eq.${periodKey}-01&select=account_id&limit=1`);
  return Boolean(rows[0]);
}

function toInvoice(row: InvoiceRow, now = new Date()): BillingInvoice {
  const storedStatus = row.status === "void" ? "open" : row.status;
  return { id: row.id, periodKey: row.period_start.slice(0, 7), amountXof: row.amount, status: effectiveInvoiceStatus(storedStatus, new Date(row.due_at), now), issuedAt: row.issued_at, dueAt: row.due_at, graceEndsAt: row.grace_ends_at, paidAt: row.paid_at ?? undefined };
}

export async function ensureDueInvoices(accountId: string, now = new Date()) {
  const currentPeriodStart = periodStartFor(now);
  const [usage, existing] = await Promise.all([
    supabaseRequest<UsageRow[]>(`billing_usage_events?account_id=eq.${encodeFilter(accountId)}&period_start=lt.${currentPeriodStart}&select=period_start`),
    supabaseRequest<InvoiceRow[]>(`billing_invoices?account_id=eq.${encodeFilter(accountId)}&select=period_start`),
  ]);
  const invoicedPeriods = new Set(existing.map((row) => row.period_start));
  const missingPeriods = [...new Set(usage.map((row) => row.period_start))].filter((periodStart) => !invoicedPeriods.has(periodStart));
  if (!missingPeriods.length) return;
  await supabaseRequest("billing_invoices?on_conflict=account_id,period_start", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(missingPeriods.map((periodStart) => {
      const dates = invoiceDates(periodStart.slice(0, 7));
      return { account_id: accountId, period_start: periodStart, amount: MONTHLY_PRICE_XOF, currency: "XOF", status: "open", issued_at: dates.issuedAt.toISOString(), due_at: dates.dueAt.toISOString(), grace_ends_at: dates.graceEndsAt.toISOString() };
    })),
  });
}

export async function listInvoices(accountId: string, now = new Date()) {
  await ensureDueInvoices(accountId, now);
  const rows = await supabaseRequest<InvoiceRow[]>(`billing_invoices?account_id=eq.${encodeFilter(accountId)}&select=*&order=issued_at.desc&limit=24`);
  return rows.map((row) => toInvoice(row, now));
}

export async function getInvoiceForCustomer(invoiceId: string, accountId: string) {
  const rows = await supabaseRequest<InvoiceRow[]>(`billing_invoices?id=eq.${encodeFilter(invoiceId)}&account_id=eq.${encodeFilter(accountId)}&select=*&limit=1`);
  return rows[0];
}

export async function createTransaction(invoiceId: string, internalReference: string) {
  const rows = await supabaseRequest<TransactionRow[]>("payment_transactions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ invoice_id: invoiceId, provider: "paydunya", internal_reference: internalReference, status: "created", amount: MONTHLY_PRICE_XOF, currency: "XOF" }),
  });
  return rows[0];
}

export async function activatePayDunyaTransaction(internalReference: string, invoiceToken: string, paymentUrl: string) {
  await supabaseRequest(`payment_transactions?internal_reference=eq.${encodeFilter(internalReference)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ provider_token: invoiceToken, status: "pending", checkout_url: paymentUrl, updated_at: new Date().toISOString() }) });
}

export async function markInvoicePending(invoiceId: string) {
  await supabaseRequest(`billing_invoices?id=eq.${encodeFilter(invoiceId)}&status=neq.paid`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "pending", updated_at: new Date().toISOString() }) });
}

export async function recordPaymentWebhook(providerToken: string, providerStatus: string) {
  const eventKey = createHash("sha256").update(`paydunya:${providerToken}:${providerStatus}`).digest("hex");
  await supabaseRequest("payment_webhook_events?on_conflict=event_key", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ provider: "paydunya", provider_token: providerToken, provider_status: providerStatus.slice(0, 40), event_key: eventKey, processed_at: new Date().toISOString() }) });
}

export async function markTransaction(providerToken: string, status: "accepted" | "refused") {
  const rows = await supabaseRequest<TransactionRow[]>(`payment_transactions?provider_token=eq.${encodeFilter(providerToken)}&select=*&limit=1`);
  const transaction = rows[0];
  if (!transaction) return false;
  const transactionStatus = status === "accepted" ? "completed" : "failed";
  await supabaseRequest(`payment_transactions?provider_token=eq.${encodeFilter(providerToken)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: transactionStatus, updated_at: new Date().toISOString() }) });
  if (status === "accepted") {
    await supabaseRequest(`billing_invoices?id=eq.${encodeFilter(transaction.invoice_id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
  } else {
    await supabaseRequest(`billing_invoices?id=eq.${encodeFilter(transaction.invoice_id)}&status=neq.paid`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "open", updated_at: new Date().toISOString() }) });
  }
  return true;
}
