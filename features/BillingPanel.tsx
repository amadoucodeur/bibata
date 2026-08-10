"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import mascotAvatar from "@/public/brand/bibata-avatar.webp";
import { periodLabel, type BillingInvoice } from "@/billing/domain";

interface BillingStatus {
  configured: boolean;
  authenticated?: boolean;
  migrationRequired?: boolean;
  paymentConfigured: boolean;
  priceXof: number;
  authUser?: { id: string; name: string; email: string; avatarUrl?: string };
  account?: { name: string; email: string; phone: string } | null;
  invoices?: BillingInvoice[];
  currentMonthActive?: boolean;
  error?: string;
}

const money = new Intl.NumberFormat("fr-FR");
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Africa/Abidjan" });

async function requestBillingStatus() {
  const response = await fetch("/api/billing/status", { cache: "no-store" });
  const payload = await response.json() as BillingStatus;
  if (!response.ok) throw new Error(payload.error || "La facturation est indisponible.");
  return payload;
}

function invoiceCopy(invoice: BillingInvoice) {
  if (invoice.status === "paid") return { label: "Payée", action: "Réglée", tone: "paid" };
  if (invoice.status === "pending") return { label: "Paiement en cours", action: "Reprendre", tone: "pending" };
  if (invoice.status === "overdue") return { label: "En retard", action: "Régler", tone: "overdue" };
  return { label: `À régler avant le ${shortDate.format(new Date(invoice.dueAt))}`, action: "Régler", tone: "open" };
}

export function BillingPanel({ activeMissionId }: { activeMissionId?: string }) {
  const [status, setStatus] = useState<BillingStatus>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("+225 ");

  const loadStatus = useCallback(async () => {
    try {
      const payload = await requestBillingStatus();
      setStatus(payload);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "La facturation est indisponible.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    requestBillingStatus().then((payload) => {
      if (!cancelled) setStatus(payload);
    }).catch((loadError: unknown) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "La facturation est indisponible.");
    });
    return () => { cancelled = true; };
  }, []);

  const register = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, activeMissionId }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Le compte n’a pas pu être créé.");
      await loadStatus();
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : "Le compte n’a pas pu être créé.");
    } finally {
      setBusy(false);
    }
  };

  const pay = async (invoiceId: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId }) });
      const payload = await response.json() as { paymentUrl?: string; error?: string };
      if (!response.ok || !payload.paymentUrl) throw new Error(payload.error || "Le paiement n’a pas pu être ouvert.");
      window.location.assign(payload.paymentUrl);
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Le paiement n’a pas pu être ouvert.");
      setBusy(false);
    }
  };

  if (!status && !error) return <section className="billing-card billing-loading" aria-busy="true"><span className="billing-pulse" /><div><strong>Facturation</strong><p>Chargement de ton espace individuel…</p></div></section>;

  if (status && !status.configured) return <section className="billing-card billing-setup"><span className="billing-avatar" aria-hidden="true"><Image src={mascotAvatar} alt="" sizes="48px" /></span><div><strong>{status.migrationRequired ? "Supabase est connecté" : status.paymentConfigured ? "PayDunya est connecté" : "Facturation bientôt disponible"}</strong><p>{status.migrationRequired ? "Les clés fonctionnent. Il reste à installer les tables de facturation dans ce projet Supabase." : status.paymentConfigured ? "Les clés de paiement sont reconnues. Il reste à connecter la base sécurisée pour conserver les comptes et les factures." : "Il reste à connecter la base sécurisée et PayDunya sur le serveur."}</p></div></section>;

  if (status && !status.authenticated) return <section className="billing-onboarding">
    <div className="billing-intro"><span className="billing-avatar" aria-hidden="true"><Image src={mascotAvatar} alt="" sizes="54px" /></span><div><strong>Ton compte individuel</strong><p>Connecte-toi avec Google pour retrouver tes factures et protéger ton identité sur tous tes appareils.</p></div></div>
    <a className="google-auth-button" href="/auth/google?next=/?onglet=reglages"><span aria-hidden="true">G</span>Continuer avec Google</a>
    {error && <p className="billing-error" role="alert">{error}</p>}
  </section>;

  if (status && !status.account) return <section className="billing-onboarding">
    <div className="billing-intro"><span className="billing-auth-mark" aria-hidden="true">G</span><div><strong>{status.authUser?.name}</strong><p>{status.authUser?.email} · identité Google vérifiée</p></div></div>
    <div className="billing-price-note"><strong>1 000 FCFA par mois actif</strong><p>Tu paies le mois suivant, seulement si tu as utilisé Bibata. Aucun prélèvement automatique.</p></div>
    <form onSubmit={register} className="billing-form">
      <label><span>Numéro Mobile Money</span><input required type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+225 07 00 00 00 00" /></label>
      <button type="submit" disabled={busy}>{busy ? "Création…" : "Activer ma facturation"}<span aria-hidden="true">→</span></button>
    </form>
    {error && <p className="billing-error" role="alert">{error}</p>}
  </section>;

  const invoices = status?.invoices ?? [];
  return <section className="billing-dashboard">
    <div className="billing-plan"><div><small>Formule individuelle</small><strong>{money.format(status?.priceXof ?? 1_000)} FCFA <span>/ mois actif</span></strong></div><span className={status?.currentMonthActive ? "active" : "quiet"}>{status?.currentMonthActive ? "Mois en cours actif" : "Aucun usage facturé ce mois"}</span></div>
    <div className="billing-account"><div><strong>{status?.account?.name}</strong><small>{status?.account?.email} · {status?.account?.phone}</small></div><span aria-hidden="true">✓</span></div>
    {invoices.length ? <div className="invoice-list">{invoices.map((invoice) => {
      const copy = invoiceCopy(invoice);
      return <article className={`invoice-row ${copy.tone}`} key={invoice.id}><div><small>{periodLabel(invoice.periodKey)}</small><strong>{money.format(invoice.amountXof)} FCFA</strong><span>{copy.label}</span></div>{invoice.status === "paid" ? <b aria-label="Facture payée">✓</b> : <button type="button" disabled={busy || !status?.paymentConfigured} onClick={() => void pay(invoice.id)}>{status?.paymentConfigured ? copy.action : "Paiement à connecter"}</button>}</article>;
    })}</div> : <div className="billing-empty"><span aria-hidden="true">○</span><div><strong>Aucune facture en attente</strong><p>La facture d’un mois actif apparaît au début du mois suivant.</p></div></div>}
    {error && <p className="billing-error" role="alert">{error}</p>}
    <form action="/auth/logout" method="post" className="billing-logout"><button type="submit">Se déconnecter de ce compte</button></form>
  </section>;
}
