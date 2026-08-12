const clean = (value: string | undefined) => value?.trim() ?? "";

export function getBillingStoreConfig() {
  const projectId = clean(process.env.SUPABASE_PROJECT_ID);
  const supabaseUrl = (clean(process.env.SUPABASE_URL) || (projectId ? `https://${projectId}.supabase.co` : "")).replace(/\/$/, "");
  const secretKey = clean(process.env.SUPABASE_SECRET_KEY) || clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!supabaseUrl || !secretKey) return undefined;
  return { supabaseUrl, secretKey };
}

export function getSupabaseAuthConfig() {
  const projectId = clean(process.env.SUPABASE_PROJECT_ID);
  const supabaseUrl = (clean(process.env.SUPABASE_URL) || (projectId ? `https://${projectId}.supabase.co` : "")).replace(/\/$/, "");
  const publishableKey = clean(process.env.SUPABASE_PUBLISHABLE_KEY) || clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (!supabaseUrl || !publishableKey) return undefined;
  return { supabaseUrl, publishableKey };
}

export function getPayDunyaConfig() {
  const principalKey = clean(process.env.PAYDUNYA_PRINCIPAL_KEY);
  const publicKey = clean(process.env.PAYDUNYA_PUBLIC_KEY);
  const privateKey = clean(process.env.PAYDUNYA_PRIVATE_KEY);
  const token = clean(process.env.PAYDUNYA_TOKEN);
  const requestedMode = clean(process.env.PAYDUNYA_MODE).toLowerCase();
  const mode = requestedMode === "test" || requestedMode === "sandbox" || privateKey.startsWith("test_") ? "test" : "production";
  if (!principalKey || !publicKey || !privateKey || !token) return undefined;
  return { principalKey, publicKey, privateKey, token, mode } as const;
}

export function getPaymentBaseUrl(requestUrl: string) {
  const configured = clean(process.env.APP_BASE_URL).replace(/\/$/, "");
  if (/^https?:\/\//.test(configured)) return configured;
  return new URL(requestUrl).origin;
}

export function getRequestOrigin(requestUrl: string) {
  return new URL(requestUrl).origin;
}
