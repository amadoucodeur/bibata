import type { NextRequest } from "next/server";
import { updateSupabaseSession } from "@/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/", "/auth/:path*", "/api/auth/:path*", "/api/billing/:path*", "/api/sync"],
};
