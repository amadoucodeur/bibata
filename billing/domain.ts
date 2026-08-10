export const MONTHLY_PRICE_XOF = 1_000;
export const PAYMENT_DUE_DAYS = 7;
export const PAYMENT_GRACE_DAYS = 7;

export type BillingInvoiceStatus = "open" | "pending" | "paid" | "overdue";

export interface BillingInvoice {
  id: string;
  periodKey: string;
  amountXof: number;
  status: BillingInvoiceStatus;
  issuedAt: string;
  dueAt: string;
  graceEndsAt: string;
  paidAt?: string;
}

export function periodKeyFor(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousPeriodKey(date: Date) {
  return periodKeyFor(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)));
}

export function periodLabel(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  if (!year || !month) return periodKey;
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Abidjan" })
    .format(new Date(Date.UTC(year, month - 1, 1)));
}

export function invoiceDates(periodKey: string) {
  const [year, month] = periodKey.split("-").map(Number);
  const issuedAt = new Date(Date.UTC(year, month, 1));
  const dueAt = new Date(issuedAt);
  dueAt.setUTCDate(dueAt.getUTCDate() + PAYMENT_DUE_DAYS);
  const graceEndsAt = new Date(dueAt);
  graceEndsAt.setUTCDate(graceEndsAt.getUTCDate() + PAYMENT_GRACE_DAYS);
  return { issuedAt, dueAt, graceEndsAt };
}

export function effectiveInvoiceStatus(status: BillingInvoiceStatus, dueAt: Date, now = new Date()): BillingInvoiceStatus {
  if (status === "paid" || status === "pending") return status;
  return now.getTime() > dueAt.getTime() ? "overdue" : "open";
}

