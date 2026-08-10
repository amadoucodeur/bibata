import { MONTHLY_PRICE_XOF } from "@/billing/domain";
import { parsePayDunyaNotificationData, verifyPayDunya } from "@/billing/paydunya";
import { markTransaction, recordPaymentWebhook } from "@/billing/repository";

export const runtime = "nodejs";

export async function GET() {
  return new Response("Bibata PayDunya IPN", { status: 200 });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const notification = parsePayDunyaNotificationData(form);
    if (!notification?.token) return new Response("Invalid notification", { status: 400 });
    const verification = await verifyPayDunya(notification.token);
    if (verification.status === "pending") return new Response("OK", { status: 200 });
    const accepted = verification.status === "completed" && verification.amount === MONTHLY_PRICE_XOF && verification.token === notification.token;
    await recordPaymentWebhook(notification.token, verification.status ?? "unknown");
    await markTransaction(notification.token, accepted ? "accepted" : "refused");
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("PayDunya notification failed", error);
    return new Response("Verification failed", { status: 500 });
  }
}
