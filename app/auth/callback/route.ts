import { NextResponse } from "next/server";
import { getPaymentBaseUrl } from "@/billing/config";
import { createSupabaseServerClient } from "@/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = getPaymentBaseUrl(request.url);
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") ?? "/?onglet=reglages";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/?onglet=reglages";
  const supabase = await createSupabaseServerClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}${next.includes("?") ? "&" : "?"}auth=connecte`);
  }
  return NextResponse.redirect(`${origin}/?auth=erreur&onglet=reglages`);
}

