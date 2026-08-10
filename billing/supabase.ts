import { getBillingStoreConfig } from "./config";

export class BillingStoreError extends Error {
  constructor(readonly code: string, message: string, readonly status = 500) {
    super(message);
  }
}

export async function supabaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const config = getBillingStoreConfig();
  if (!config) throw new BillingStoreError("BILLING_NOT_CONFIGURED", "La facturation serveur n’est pas encore configurée.", 503);
  const headers = new Headers(init.headers);
  headers.set("apikey", config.secretKey);
  if (!config.secretKey.startsWith("sb_secret_")) headers.set("Authorization", `Bearer ${config.secretKey}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const detail = await response.text();
    try {
      const payload = JSON.parse(detail) as { code?: string };
      if (payload.code === "PGRST205") throw new BillingStoreError("BILLING_SCHEMA_MISSING", "Les tables de facturation n’ont pas encore été installées.", 503);
      if (payload.code === "23505") throw new BillingStoreError("BILLING_CONFLICT", "Ces coordonnées sont déjà associées à un autre compte Bibata.", 409);
    } catch (error) {
      if (error instanceof BillingStoreError) throw error;
    }
    console.error("Billing store request failed", response.status, detail.slice(0, 500));
    throw new BillingStoreError("BILLING_STORE_ERROR", "La facturation est momentanément indisponible.", 502);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const encodeFilter = (value: string) => encodeURIComponent(value);
