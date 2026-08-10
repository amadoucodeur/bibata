import { getAuthenticatedUser } from "@/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthenticatedUser();
  return Response.json({ authenticated: Boolean(user) });
}
