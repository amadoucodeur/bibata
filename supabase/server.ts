import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAuthConfig } from "@/billing/config";

export async function createSupabaseServerClient() {
  const config = getSupabaseAuthConfig();
  if (!config) return undefined;
  const cookieStore = await cookies();
  return createServerClient(config.supabaseUrl, config.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const cookie of cookiesToSet) cookieStore.set(cookie.name, cookie.value, cookie.options);
      },
    },
  });
}

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return undefined;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return undefined;
  const metadata = data.user.user_metadata ?? {};
  return {
    id: data.user.id,
    email: data.user.email,
    name: String(metadata.full_name || metadata.name || data.user.email.split("@")[0]).slice(0, 80),
    avatarUrl: typeof metadata.avatar_url === "string" ? metadata.avatar_url : undefined,
  };
}

