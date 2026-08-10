import { NextResponse } from "next/server";
import { getPaymentBaseUrl } from "@/billing/config";
import { createSupabaseServerClient } from "@/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const origin = getPaymentBaseUrl(request.url);
  if (!supabase) return NextResponse.redirect(`${origin}/?auth=configuration`);
  const { searchParams } = new URL(request.url);
  const requestedNext = searchParams.get("next") ?? "/?onglet=reglages";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/?onglet=reglages";
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  if (error || !data.url) return NextResponse.redirect(`${origin}/?auth=erreur&onglet=reglages`);
  return NextResponse.redirect(data.url);
}

