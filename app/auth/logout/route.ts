import { NextResponse } from "next/server";
import { getPaymentBaseUrl } from "@/billing/config";
import { createSupabaseServerClient } from "@/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(`${getPaymentBaseUrl(request.url)}/?onglet=reglages`, { status: 303 });
}
