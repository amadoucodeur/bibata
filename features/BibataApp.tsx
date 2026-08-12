"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import mascotAvatar from "@/public/brand/bibata-avatar.webp";
import logoMark from "@/public/brand/bibata-logo-d.png";
import mascot from "@/public/brand/bibata-mascot.webp";
import { AIProviderError, aiProvider } from "@/ai/provider";
import { countCompletedConversationTurns, findConceptsUsedByLearner, getAvailableConversationReplies, getDirectConversationOpening } from "@/core/conversation";
import { calculateMissionScore, createEmptyMastery, getAssimilatedConceptIds, isConceptAssimilated, updateConceptMastery } from "@/core/learning-engine";
import { buildMissionsFromPlan, getMissionsForProfile } from "@/core/personalization";
import { getConcept, getTrackMeta, interestOptions, languages, missions, roadmap } from "@/data/curriculum";
import { getContextVisual } from "@/data/context-visuals";
import { emptyState, storageRepository } from "@/storage/repository";
import { mergeFromCloud } from "@/storage/cloud-sync";
import { usePWA } from "@/features/usePWA";
import { getInstallInviteCopy, getManualInstallGuide, type InstallPlatform } from "@/features/pwa-platform";
import { playUISound, speakText, useAudio } from "@/features/audio";
import { parseMessageText } from "@/features/message-format";
import { BillingPanel } from "@/features/BillingPanel";
import {
  CEFR_LEVELS,
  type CEFRLevel,
  type ConversationMessage,
  type ConceptMastery,
  type Exercise,
  type ExerciseAttempt,
  type LearningProfile,
  type Mission,
  type MissionScore,
  type PersistedState,
} from "@/types/learning";

type View = "onboarding-language" | "onboarding-level" | "onboarding-interests" | "home" | "progress" | "settings" | "mission";
type MissionStage = "intro" | "discover" | "context" | "exercise" | "conversation" | "result";
type PlanningTask = "first-plan" | "recompose" | "next-mission" | "migration";
type PlanningState = { mode: "foreground" | "background"; task: PlanningTask } | null;

const INSTALL_NUDGE_KEY = "bibata-install-nudge-dismissed-at";
const INSTALL_NUDGE_SNOOZE_MS = 7 * 24 * 60 * 60_000;
const INSTALL_NUDGE_EVENT = "bibata-install-nudge-change";
const ACCOUNT_NUDGE_KEY = "bibata-account-nudge-dismissed-at";
const ACCOUNT_NUDGE_SNOOZE_MS = 7 * 24 * 60 * 60_000;
const ACCOUNT_NUDGE_EVENT = "bibata-account-nudge-change";

function subscribeToInstallNudge(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(INSTALL_NUDGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(INSTALL_NUDGE_EVENT, callback);
  };
}

function getInstallNudgeSnapshot() {
  const dismissedAt = Number(window.localStorage.getItem(INSTALL_NUDGE_KEY));
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < INSTALL_NUDGE_SNOOZE_MS;
}

function getInstallNudgeServerSnapshot() {
  return true;
}

function subscribeToAccountNudge(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(ACCOUNT_NUDGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(ACCOUNT_NUDGE_EVENT, callback);
  };
}

function getAccountNudgeSnapshot() {
  const dismissedAt = Number(window.localStorage.getItem(ACCOUNT_NUDGE_KEY));
  return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < ACCOUNT_NUDGE_SNOOZE_MS;
}

function getAccountNudgeServerSnapshot() {
  return true;
}

const initialAbility = { vocabulary: 0.12, grammar: 0.1, comprehension: 0.14, recall: 0.08, production: 0.06 };
const normalizeAnswer = (value: string) => value.toLowerCase().replace(/[.!?,’']/g, "").replace(/\s+/g, " ").trim();
const levelDescriptions: Record<CEFRLevel, string> = { A1: "Débutant", A2: "Élémentaire", B1: "Intermédiaire", B2: "Intermédiaire avancé", C1: "Autonome", C2: "Maîtrise" };
const levelHints: Record<CEFRLevel, string> = {
  A1: "Je découvre la langue",
  A2: "Je comprends des phrases simples",
  B1: "Je peux tenir une conversation",
  B2: "Je m’exprime avec assez d’aisance",
  C1: "Je parle de sujets complexes",
  C2: "Je cherche précision et nuances",
};
const firstMissionGreetings: Record<CEFRLevel, string> = {
  A1: "Prêt·e pour tes premiers mots ?",
  A2: "Prêt·e à gagner en autonomie ?",
  B1: "Prêt·e à raconter et argumenter ?",
  B2: "Prêt·e à parler avec plus de naturel ?",
  C1: "Prêt·e à affiner ta pensée ?",
  C2: "Prêt·e à jouer avec les nuances ?",
};
const LogoMark = ({ className = "" }: { className?: string }) => (
  <Image className={`logo-symbol ${className}`.trim()} src={logoMark} alt="" aria-hidden="true" sizes="40px" />
);

const Logo = () => <span className="brand" aria-label="Bibata"><LogoMark /><span>Bibata</span></span>;

function BibataCoach({ children, title = "Le conseil de Bibata", tone = "guide", compact = false, announce = false }: { children: ReactNode; title?: string; tone?: "guide" | "success" | "gentle" | "dark"; compact?: boolean; announce?: boolean }) {
  return <aside className={`bibata-coach ${tone} ${compact ? "compact" : ""}`.trim()} aria-label={title} role={announce ? "status" : undefined} aria-live={announce ? "polite" : undefined}>
    <span className="bibata-coach-avatar" aria-hidden="true"><Image src={mascotAvatar} alt="" sizes={compact ? "46px" : "58px"} /></span>
    <div><strong>{title}</strong><p>{children}</p></div>
  </aside>;
}

function AIWaitingScreen({ task, level }: { task: PlanningTask; level: CEFRLevel }) {
  const [messageIndex, setMessageIndex] = useState(0);
  const copy: Record<PlanningTask, { eyebrow: string; title: string; description: string }> = {
    "first-plan": { eyebrow: "Une route rien qu’à toi", title: "Ton parcours prend forme.", description: "Bibata assemble une première mission à partir de ton niveau et de ce qui t’intéresse." },
    recompose: { eyebrow: "Un nouveau souffle", title: "Bibata redessine ton parcours.", description: "Elle garde ton niveau, puis imagine un autre chemin pour rendre la suite plus vivante." },
    "next-mission": { eyebrow: "La suite se révèle", title: "Ta prochaine mission se compose.", description: "Le fil continue, mais la situation change pour que ton expérience reste surprenante." },
    migration: { eyebrow: "Parcours personnel", title: "Bibata prépare ta nouvelle route.", description: "Ton expérience existante est conservée pendant que la suite devient plus personnelle." },
  };
  const messages = [
    "Je relie tes centres d’intérêt…",
    `J’accorde les échanges à ton niveau ${level}…`,
    "Je prépare une situation vivante et différente…",
  ];

  useEffect(() => {
    const timer = window.setInterval(() => setMessageIndex((current) => (current + 1) % 3), 2_200);
    return () => window.clearInterval(timer);
  }, []);

  const current = copy[task];
  return <main className="ai-waiting-screen page-enter" aria-busy="true">
    <header className="ai-waiting-header"><Logo /><span className="ai-live-pill"><i aria-hidden="true" /> IA en cours</span></header>
    <section className="ai-waiting-content">
      <div className="ai-loom" aria-hidden="true">
        <span className="ai-orbit orbit-one" /><span className="ai-orbit orbit-two" />
        <span className="ai-spark spark-one">✦</span><span className="ai-spark spark-two">·</span><span className="ai-spark spark-three">✦</span>
        <span className="ai-thought thought-one">mot</span><span className="ai-thought thought-two">{level}</span><span className="ai-thought thought-three">idée</span>
        <span className="ai-mascot-halo" />
        <Image className="ai-mascot" src={mascot} alt="" sizes="(min-width: 700px) 210px, 180px" />
      </div>
      <p className="eyebrow">{current.eyebrow}</p>
      <h1>{current.title}</h1>
      <p className="ai-waiting-description">{current.description}</p>
      <div className="ai-status" role="status" aria-live="polite">
        <span className="ai-status-mark" aria-hidden="true"><i /><i /><i /></span>
        <p key={messageIndex}>{messages[messageIndex]}</p>
      </div>
      <div className="ai-indeterminate" aria-hidden="true"><span /></div>
      <small>Tu n’as rien à faire, Bibata s’occupe du fil.</small>
    </section>
  </main>;
}

function ProgressLine({ value, label = "Progression" }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <span className="progress-line" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}><span style={{ width: `${safeValue}%` }} /></span>;
}

function SpeechButton({ text, language, enabled, label = "Écouter la prononciation" }: { text: string; language: string; enabled: boolean; label?: string }) {
  return <button className="speech-button" type="button" disabled={!enabled} onClick={() => speakText(text, language)} aria-label={`${label} : ${text}`} title={enabled ? label : "Active les sons dans les réglages"}><span aria-hidden="true">{enabled ? "◖))" : "◖×"}</span>{enabled ? "Écouter" : "Son coupé"}</button>;
}

function Toast({ message }: { message: string }) {
  return <div className="toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span>{message}</div>;
}

function ConfirmDialog({ title, description, confirmLabel, onCancel, onConfirm }: { title: string; description: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><span className="dialog-mark" aria-hidden="true">!</span><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p><div><button ref={cancelRef} className="secondary-button" type="button" onClick={onCancel}>Continuer</button><button className="danger-button" type="button" onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

function InstallGuideDialog({ platform, onClose }: { platform: InstallPlatform; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const guide = getManualInstallGuide(platform);
  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="install-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="install-guide-title"><span className="install-guide-avatar" aria-hidden="true"><Image src={mascotAvatar} alt="" sizes="72px" /></span><p className="eyebrow">{guide.eyebrow}</p><h2 id="install-guide-title">{guide.title}</h2><p>{guide.description}</p><ol>{guide.steps.map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}</ol><button ref={closeRef} className="primary-button" type="button" onClick={onClose}>J’ai compris <span>✓</span></button></section></div>;
}

function AccountRequiredDialog({ onClose }: { onClose: () => void }) {
  const connectRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    connectRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return <div className="dialog-backdrop" role="presentation"><section className="account-required-dialog" role="dialog" aria-modal="true" aria-labelledby="account-required-title" aria-describedby="account-required-description"><span className="account-required-avatar" aria-hidden="true"><Image src={mascotAvatar} alt="" sizes="78px" /></span><p className="eyebrow">Première mission terminée</p><h2 id="account-required-title">Connecte-toi pour continuer</h2><p id="account-required-description">Ta première mission reste gratuite et enregistrée sur cet appareil. Un compte Google est maintenant nécessaire pour débloquer la suite et protéger ta progression.</p><a ref={connectRef} href="/auth/google?next=/">Continuer avec Google <span aria-hidden="true">→</span></a><button type="button" onClick={onClose}>Revenir à l’accueil</button></section></div>;
}

function OnboardingLanguage({ showInstallInvite, installPlatform, canInstall, onInstall, onChoose }: { showInstallInvite: boolean; installPlatform: InstallPlatform; canInstall: boolean; onInstall: () => void; onChoose: (code: string) => void }) {
  const installCopy = getInstallInviteCopy(installPlatform, canInstall);
  return <main className="onboarding-shell page-enter">
    <header className="onboarding-header"><Logo /><span className="step-count">1 sur 3</span></header>
    {showInstallInvite && <button className="onboarding-install-card" type="button" onClick={onInstall} aria-label={`${installCopy.title}. ${installCopy.action}`}><span className="onboarding-install-avatar" aria-hidden="true"><Image src={mascotAvatar} alt="" sizes="58px" /></span><span className="onboarding-install-copy"><small>Bibata sur ton appareil</small><strong>{installCopy.title}</strong><span>Accès rapide · plein écran · toujours à portée</span></span><span className="onboarding-install-action" aria-hidden="true">{installCopy.action}<b>→</b></span></button>}
    <section className="onboarding-copy"><p className="eyebrow">Commençons simplement</p><h1>Quelle langue<br />veux-tu vivre ?</h1><p>Choisis ton premier parcours. Chaque langue gardera ensuite sa propre progression.</p></section>
    <div className="language-list" role="list">
      {languages.map((language, index) => <button type="button" className={`language-option ${index === 0 ? "active" : ""}`} key={language.code} onClick={() => onChoose(language.code)} disabled={language.availability === "preview"}>
        <span className="flag-disc" aria-hidden="true">{language.flag}</span><span className="language-label"><strong>{language.name}</strong><small>{index === 0 ? "Disponible maintenant" : "Bientôt disponible"}</small></span><span className="option-arrow" aria-hidden="true">{index === 0 ? "→" : ""}</span>
      </button>)}
    </div>
    <p className="onboarding-note"><span aria-hidden="true">⌁</span> Ta progression reste privée sur cet appareil.</p>
  </main>;
}

function OnboardingLevel({ selected, onBack, onSelect, onContinue }: { selected: CEFRLevel; onBack: () => void; onSelect: (level: CEFRLevel) => void; onContinue: () => void }) {
  return <main className="onboarding-shell page-enter">
    <header className="onboarding-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Retour">←</button><span className="step-count">2 sur 3</span></header>
    <section className="onboarding-copy compact"><p className="eyebrow">À ton rythme</p><h1>Où en es-tu<br />aujourd’hui ?</h1><p>Ce choix adapte immédiatement le parcours, les exercices et les conversations. Tu pourras le modifier à tout moment.</p></section>
    <div className="level-options" aria-label="Choisir un niveau CECR">
      {CEFR_LEVELS.map((level) => { const active = level === selected; return <button key={level} type="button" className={active ? "selected" : ""} aria-pressed={active} onClick={() => onSelect(level)}><span>{level}</span><div><strong>{levelDescriptions[level]}</strong><small>{levelHints[level]}</small></div><i aria-hidden="true">{active ? "✓" : ""}</i></button>; })}
    </div>
    <div className="sticky-action"><button className="primary-button" type="button" onClick={onContinue}>Continuer <span>→</span></button></div>
  </main>;
}

function OnboardingInterests({ loading, error, onBack, onContinue }: { loading: boolean; error: string; onBack: () => void; onContinue: (interests: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(["travel", "music"]);
  const [custom, setCustom] = useState("");
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const submitCustom = () => { const value = custom.trim(); if (value && !selected.includes(value)) setSelected((current) => [...current, value]); setCustom(""); };
  return <main className="onboarding-shell page-enter">
    <header className="onboarding-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Retour">←</button><span className="step-count">3 sur 3</span></header>
    <section className="onboarding-copy compact"><p className="eyebrow">Une touche personnelle</p><h1>Qu’est-ce qui<br />t’intéresse ?</h1><p>Choisis au moins un thème : Bibata s’en servira pour rendre les échanges plus naturels.</p></section>
    <div className="interest-grid">
      {interestOptions.map((interest) => { const active = selected.includes(interest.id); return <button type="button" key={interest.id} className={`interest-chip ${active ? "selected" : ""}`} onClick={() => toggle(interest.id)} aria-pressed={active}><span aria-hidden="true">{interest.icon}</span>{interest.label}<i aria-hidden="true">{active ? "✓" : "+"}</i></button>; })}
    </div>
    <form className="custom-interest" onSubmit={(event) => { event.preventDefault(); submitCustom(); }}><input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Ajouter un intérêt…" aria-label="Ajouter un intérêt" /><button type="submit" disabled={!custom.trim()} aria-label="Ajouter cet intérêt">+</button></form>
    <div className="custom-tags">{selected.filter((item) => !interestOptions.some((option) => option.id === item)).map((item) => <button type="button" className="custom-tag" key={item} onClick={() => toggle(item)}>{item} <span aria-hidden="true">×</span></button>)}</div>
    {error && <div className="plan-error" role="alert"><strong>Le parcours n’a pas pu être préparé</strong><p>{error}</p></div>}
    <div className="sticky-action"><button className="primary-button" type="button" onClick={() => onContinue(selected)} disabled={selected.length === 0 || loading}>{loading ? "Bibata compose ton parcours…" : "Créer mon parcours"} <span>{loading ? "✦" : "→"}</span></button></div>
  </main>;
}

function BottomNav({ active, onNavigate }: { active: View; onNavigate: (view: View) => void }) {
  const items: Array<{ id: "home" | "progress" | "settings"; icon: string; label: string }> = [
    { id: "home", icon: "⌂", label: "Accueil" },
    { id: "progress", icon: "↗", label: "Parcours" },
    { id: "settings", icon: "◌", label: "Réglages" },
  ];
  return <nav className="bottom-nav" aria-label="Navigation principale">{items.map((item) => <button className={active === item.id ? "active" : ""} aria-current={active === item.id ? "page" : undefined} onClick={() => onNavigate(item.id)} type="button" key={item.id}><span aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>;
}

function AppHeader({ completedCount }: { completedCount: number }) {
  return <header className="app-header"><Logo /><span className="completion-badge" aria-label={`${completedCount} mission${completedCount > 1 ? "s" : ""} terminée${completedCount > 1 ? "s" : ""}`}><span aria-hidden="true">✓</span>{completedCount}</span></header>;
}

function HomeScreen({ profile, availableMissions, learnedCount, showInstallNudge, showAccountNudge, installPlatform, offlineReady, planningPlan, planIssue, onContinue, onRetry, onInstall, onDismissInstall, onDismissAccount, onNavigate }: { profile: LearningProfile; availableMissions: Mission[]; learnedCount: number; showInstallNudge: boolean; showAccountNudge: boolean; installPlatform: InstallPlatform; offlineReady: boolean; planningPlan: boolean; planIssue: string; onContinue: () => void; onRetry: () => void; onInstall: () => void; onDismissInstall: () => void; onDismissAccount: () => void; onNavigate: (view: View) => void }) {
  const currentLevel = profile.estimatedLevel ?? "A1";
  const nextMission = availableMissions.find((mission) => !profile.completedMissionIds.includes(mission.id));
  const completed = availableMissions.filter((mission) => profile.completedMissionIds.includes(mission.id)).length;
  const currentWorld = roadmap.worlds[0];
  const currentWorldMissions = availableMissions.filter((mission) => mission.worldId === currentWorld.id).map((mission) => mission.id);
  const completedInWorld = currentWorldMissions.filter((id) => profile.completedMissionIds.includes(id)).length;
  const worldProgress = completed ? Math.round((completed / (completed + 1)) * 100) : 0;
  const ringStyle = { "--ring-progress": `${worldProgress * 3.6}deg` } as CSSProperties;
  const trackMeta = profile.learningPlan?.level === currentLevel
    ? { title: profile.learningPlan.title, eyebrow: profile.learningPlan.focus }
    : getTrackMeta(currentLevel);
  const installCopy = installPlatform === "ios"
    ? { title: "Installe Bibata sur ton écran", description: "Retrouve tes missions en un geste, sans rouvrir le navigateur.", action: "Ajouter à l’écran" }
    : installPlatform === "android"
      ? { title: "Installe Bibata maintenant", description: offlineReady ? "Accès immédiat, plein écran et interface disponible hors ligne." : "Ajoute Bibata comme une vraie application sur ton téléphone.", action: "Installer Bibata" }
      : { title: "Installe Bibata maintenant", description: "Lance-la en un clic, dans sa propre fenêtre, sans chercher cet onglet.", action: "Installer Bibata" };
  return <main className="app-shell page-enter"><AppHeader completedCount={completed} />
    <section className="greeting"><p>Bonjour <span aria-hidden="true">👋</span></p><h1>{completed ? "On garde le rythme ?" : firstMissionGreetings[currentLevel]}</h1></section>
    {(planningPlan || planIssue) && <section className={`plan-status-card ${planIssue ? "error" : ""}`} role={planIssue ? "alert" : "status"}><span aria-hidden="true">✦</span><div><strong>{planningPlan ? "Bibata prépare la suite…" : "La prochaine mission attend"}</strong><p>{planningPlan ? "Ton fil reste le même pendant qu’une nouvelle situation se compose discrètement." : planIssue}</p></div>{planIssue && <button type="button" onClick={onRetry}>Réessayer</button>}</section>}
    {showInstallNudge && <aside className="install-card install-card-prominent" aria-label="Installer Bibata"><button type="button" className="install-dismiss" onClick={onDismissInstall} aria-label="Me le rappeler dans sept jours">×</button><span className="install-mascot" aria-hidden="true"><Image src={mascotAvatar} alt="" sizes="68px" /></span><div><span className="install-kicker">Bibata sur ton appareil</span><strong>{installCopy.title}</strong><small>{installCopy.description}</small><span className="install-benefits" aria-label="Avantages : accès rapide, plein écran et progression conservée"><i>Accès rapide</i><i>Plein écran</i><i>Progression gardée</i></span><button type="button" className="install-action" onClick={onInstall}>{installCopy.action} <span aria-hidden="true">→</span></button></div></aside>}
    <div className="home-grid">
      <section className="hero-card" aria-labelledby="next-mission-title"><div className="hero-card-top"><span className="language-pill">{profile.languageFlag} {profile.languageName}</span><span className="hero-level">Niveau {profile.estimatedLevel ?? "A1"}</span></div>
        <div className="level-row"><div><small>Missions terminées</small><strong>{completed}</strong></div><div><small>Concepts assimilés</small><strong>{learnedCount}</strong></div></div>
        {nextMission ? <div className="mission-preview"><span className="mission-number">{String(nextMission.order).padStart(2, "0")}</span><div><small>{nextMission.kind === "consolidation" ? "Nouvelle situation de pratique" : "Prochaine mission"} · {nextMission.eyebrow}</small><h2 id="next-mission-title">{nextMission.title}</h2><p>Environ {nextMission.durationMinutes} min · {nextMission.conceptIds.length} expression{nextMission.conceptIds.length > 1 ? "s" : ""} {nextMission.kind === "consolidation" ? "à réutiliser" : "à apprendre"}</p></div></div> : <div className="mission-preview"><span className="mission-number">✦</span><div><small>Prochaine sélection</small><h2 id="next-mission-title">{planningPlan ? "Elle arrive…" : "Prête à être composée"}</h2><p>Bibata repart exactement de là où tu t’es arrêté·e.</p></div></div>}
        <button className="primary-button light" type="button" onClick={!nextMission && planIssue ? onRetry : onContinue} disabled={!nextMission && planningPlan}>{nextMission ? (completed ? "Continuer mon parcours" : "Commencer ma première mission") : (planIssue ? "Réessayer" : "Préparer la suite")}<span>{planningPlan && !nextMission ? "✦" : "→"}</span></button></section>
      <div className="home-side">
        {showAccountNudge && <aside className="account-nudge" aria-label="Sauvegarder ma progression"><button type="button" className="account-nudge-dismiss" onClick={onDismissAccount} aria-label="Me le rappeler dans sept jours">×</button><span className="account-nudge-avatar" aria-hidden="true"><Image src={mascotAvatar} alt="" sizes="54px" /></span><div><span className="account-nudge-kicker">Ta première mission est terminée</span><strong>Ne perds pas ta progression</strong><p>Connecte-toi pour la retrouver sur tes autres appareils et continuer exactement où tu t’es arrêté·e.</p><a href="/auth/google?next=/">Continuer avec Google <span aria-hidden="true">→</span></a></div></aside>}
        <section className="today-strip"><div className="mini-ring" style={ringStyle}><strong>{completedInWorld}</strong><small>✓</small></div><div><strong>{trackMeta.title}</strong><p>{completed ? "La suite évolue avec toi" : trackMeta.eyebrow}</p></div></section>
        <section className="availability-card"><span aria-hidden="true">✦</span><div><strong>Des sessions courtes, sans pression</strong><p>Une mission suffit pour avancer. Ta progression est enregistrée automatiquement.</p></div></section>
      </div>
    </div>
    <BottomNav active="home" onNavigate={onNavigate} />
  </main>;
}

function ProgressScreen({ profile, availableMissions, masteryCount, onContinue, onNavigate }: { profile: LearningProfile; availableMissions: Mission[]; masteryCount: number; onContinue: () => void; onNavigate: (view: View) => void }) {
  const currentLevel = profile.estimatedLevel ?? "A1";
  const completedCount = availableMissions.filter((mission) => profile.completedMissionIds.includes(mission.id)).length;
  const trackMeta = profile.learningPlan?.level === currentLevel
    ? { title: profile.learningPlan.title, eyebrow: profile.learningPlan.focus }
    : getTrackMeta(currentLevel);
  return <main className="app-shell page-enter"><AppHeader completedCount={completedCount} />
    <section className="page-heading"><p className="eyebrow">Ton chemin</p><h1>{profile.languageFlag} {profile.languageName}</h1><p>Une vue claire de ce que tu as déjà parcouru et de la prochaine étape.</p></section>
    <section className="level-card"><div className="level-badge">{currentLevel}</div><div><small>Niveau choisi</small><strong>{levelDescriptions[currentLevel]}</strong><p>Les missions, les exercices, les conversations et le modèle IA s’adaptent à ce niveau.</p></div><button type="button" onClick={() => onNavigate("settings")}>Modifier</button></section>
    <div className="stat-pair"><div><strong>{masteryCount}</strong><span>concepts assimilés</span></div><div><strong>{completedCount}</strong><span>missions terminées</span></div></div>
    <section className="roadmap-list" aria-label="Mondes d’apprentissage">{roadmap.worlds.map((world, index) => {
      const availableMissionIds = availableMissions.filter((mission) => mission.worldId === world.id).map((mission) => mission.id);
      const completed = availableMissionIds.filter((id) => profile.completedMissionIds.includes(id)).length;
      const available = availableMissionIds.length > 0;
      const title = index === 0 ? trackMeta.title : world.title;
      const eyebrow = index === 0 ? trackMeta.eyebrow : world.eyebrow;
      return <article className={`world-card ${available ? "current" : "locked"}`} key={world.id}><div className={`world-icon ${world.accent}`} aria-hidden="true">{index === 0 ? "✦" : index === 1 ? "⌂" : "↗"}</div><div><small>Monde {index + 1}</small><h2>{title}</h2><p>{eyebrow}</p><span>{available ? `${completed} mission${completed > 1 ? "s" : ""} terminée${completed > 1 ? "s" : ""} · la suite se révèle progressivement` : "Bientôt disponible"}</span>{available && <button type="button" onClick={onContinue}>Continuer ce monde <b aria-hidden="true">→</b></button>}</div></article>;
    })}</section>
    <BottomNav active="progress" onNavigate={onNavigate} />
  </main>;
}

interface PWAStatus {
  canInstall: boolean;
  canSuggestInstall: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  offlineReady: boolean;
  platform: InstallPlatform;
}

function SettingsScreen({ profile, mastery, billingActiveMissionId, pwa, soundEnabled, planningPlan, onInstall, onToggleSound, onNavigate, onNotify, onResetRequest, onImport, onLevelChange, onReplan }: { profile: LearningProfile; mastery: Record<string, ConceptMastery>; billingActiveMissionId?: string; pwa: PWAStatus; soundEnabled: boolean; planningPlan: boolean; onInstall: () => void; onToggleSound: () => void; onNavigate: (view: View) => void; onNotify: (message: string) => void; onResetRequest: () => void; onImport: (value: string) => void; onLevelChange: (level: CEFRLevel) => void; onReplan: () => void }) {
  const importRef = useRef<HTMLInputElement>(null);
  const currentLevel = profile.estimatedLevel ?? "A1";
  const completedCount = getMissionsForProfile(profile, currentLevel).filter((mission) => profile.completedMissionIds.includes(mission.id)).length;
  const exportData = async () => {
    const value = await storageRepository.exportJSON();
    const blob = new Blob([value], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "bibata-progress.json";
    link.click();
    URL.revokeObjectURL(link.href);
    onNotify("Sauvegarde téléchargée");
  };
  const installAvailable = pwa.canInstall || pwa.platform === "ios";
  const installDescription = pwa.isInstalled ? "Bibata est déjà installée" : pwa.platform === "ios" ? "Partager, puis Sur l’écran d’accueil" : pwa.canInstall ? "Ajoute Bibata à ton écran d’accueil" : "Disponible depuis le menu de ton navigateur";
  const assimilatedConcepts = Object.values(mastery)
    .filter(isConceptAssimilated)
    .map((item) => ({ mastery: item, concept: getConcept(item.conceptId) }))
    .filter((item) => item.concept?.language === profile.language)
    .sort((left, right) => (right.mastery.assimilatedAt ?? 0) - (left.mastery.assimilatedAt ?? 0));
  return <main className="app-shell page-enter"><AppHeader completedCount={completedCount} /><section className="page-heading"><p className="eyebrow">Ton expérience</p><h1>Réglages</h1><p>Personnalise Bibata et garde le contrôle sur tes données.</p></section>
    <div className="settings-layout">
      <div>
        <section className="settings-group"><h2>Apprentissage</h2><label className="level-setting"><span className="settings-icon">Aa</span><div><strong>Niveau du parcours</strong><small>{levelDescriptions[currentLevel]} · contenu, difficulté et modèle adaptés</small></div><select value={currentLevel} disabled={planningPlan} onChange={(event) => onLevelChange(event.target.value as CEFRLevel)} aria-label="Niveau du parcours">{CEFR_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></label><button className="settings-row" type="button" onClick={onReplan} disabled={planningPlan}><span className="settings-icon">✦</span><div><strong>{planningPlan ? "Composition en cours…" : "Recomposer mon parcours"}</strong><small>{profile.learningPlan?.focus ?? "Créer un itinéraire lié à tes intérêts"}</small></div><i aria-hidden="true">↻</i></button></section>
        <section className="settings-group"><h2>Concepts assimilés</h2><details className="assimilated-library"><summary><span className="settings-icon">✓</span><div><strong>{assimilatedConcepts.length} concept{assimilatedConcepts.length > 1 ? "s" : ""} acquis</strong><small>Retrouve les expressions validées en conversation</small></div><i aria-hidden="true">⌄</i></summary>{assimilatedConcepts.length ? <ul>{assimilatedConcepts.map(({ concept, mastery: item }) => concept && <li key={concept.id}><span>{concept.level}</span><div><strong>{concept.value}</strong><small>{concept.translation}</small></div><time dateTime={new Date(item.assimilatedAt ?? 0).toISOString()}>{new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Abidjan" }).format(item.assimilatedAt)}</time></li>)}</ul> : <p>Les concepts apparaîtront ici après un usage juste et cohérent dans le chat.</p>}</details></section>
        <section className="settings-group"><h2>Application</h2><button className="settings-row" type="button" onClick={onToggleSound} aria-pressed={soundEnabled}><span className="settings-icon">{soundEnabled ? "♫" : "×"}</span><div><strong>Sons et prononciation</strong><small>{soundEnabled ? "Voix des concepts et retours sonores activés" : "Tous les sons sont désactivés"}</small></div><i aria-hidden="true">{soundEnabled ? "✓" : "—"}</i></button><button className="settings-row" type="button" onClick={onInstall} disabled={!installAvailable || pwa.isInstalled}><span className="settings-icon">↓</span><div><strong>Installer Bibata</strong><small>{installDescription}</small></div><i aria-hidden="true">{pwa.isInstalled ? "✓" : "›"}</i></button><div className="settings-static-row"><span className={`settings-icon ${pwa.isOnline ? "online" : "offline"}`}>●</span><div><strong>{pwa.isOnline ? "Connexion disponible" : "Mode hors ligne"}</strong><small>{pwa.offlineReady ? "L’interface reste accessible hors ligne" : "Une connexion est nécessaire pour discuter avec Bibata"}</small></div><i aria-hidden="true">{pwa.isOnline ? "✓" : "—"}</i></div></section>
      </div>
      <div>
        <section className="settings-group"><h2>Facturation</h2><BillingPanel activeMissionId={billingActiveMissionId} /></section>
        <section className="settings-group"><h2>Tes données</h2><button className="settings-row" type="button" onClick={() => void exportData()}><span className="settings-icon">⇩</span><div><strong>Exporter mes données</strong><small>Télécharger une sauvegarde JSON</small></div><i aria-hidden="true">›</i></button><button className="settings-row" type="button" onClick={() => importRef.current?.click()}><span className="settings-icon">⇧</span><div><strong>Importer une sauvegarde</strong><small>Restaurer une progression Bibata</small></div><i aria-hidden="true">›</i></button><input ref={importRef} hidden type="file" accept="application/json" onChange={async (event) => { const file = event.target.files?.[0]; if (file) onImport(await file.text()); event.target.value = ""; }} /></section>
        <section className="settings-group"><h2>Zone sensible</h2><button className="settings-row danger-row" type="button" onClick={onResetRequest}><span className="settings-icon">↺</span><div><strong>Réinitialiser la progression</strong><small>Effacer les données enregistrées sur cet appareil</small></div><i aria-hidden="true">›</i></button></section>
      </div>
    </div>
    <p className="version-note">Bibata · Progression locale · Facturation sécurisée côté serveur</p><BottomNav active="settings" onNavigate={onNavigate} />
  </main>;
}

function MissionHeader({ progress, onClose }: { progress: number; onClose: () => void }) {
  return <header className="mission-header"><button type="button" className="icon-button" onClick={onClose} aria-label="Quitter la mission">×</button><ProgressLine value={progress} label="Progression de la mission" /><span>{progress}%</span></header>;
}

function ExerciseCard({ exercise, language, soundEnabled, onAnswer }: { exercise: Exercise; language: string; soundEnabled: boolean; onAnswer: (answer: string, correct: boolean) => void }) {
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState(false);
  const [tokens, setTokens] = useState<string[]>([]);
  const choices = exercise.payload.choices ?? exercise.payload.tokens ?? [];
  const answer = exercise.type === "sentence_builder" ? tokens.join(" ") : selected;
  const correct = normalizeAnswer(answer) === normalizeAnswer(exercise.payload.answer);
  const successCopy = exercise.type === "sentence_builder"
    ? "La phrase tient bien ensemble. Garde surtout son rythme en tête."
    : exercise.type === "fill_blank"
      ? "Bien vu : ce choix complète naturellement la phrase."
      : "Bien vu : tu as reconnu la bonne formulation.";
  const select = (choice: string) => {
    if (checked) return;
    if (exercise.type === "sentence_builder") setTokens((current) => current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice]);
    else setSelected(choice);
  };
  const validateOrContinue = () => {
    if (checked) {
      playUISound("transition");
      onAnswer(answer, correct);
      return;
    }
    setChecked(true);
    playUISound(correct ? "success" : "error");
  };
  return <section className="exercise-body"><p className="eyebrow">À toi de jouer</p><h1>{exercise.prompt}</h1>
    {exercise.type === "sentence_builder" && <div className="sentence-slot" aria-live="polite">{tokens.length ? tokens.join(" ") : <span>Touche les mots dans l’ordre</span>}</div>}
    <div className={exercise.type === "sentence_builder" ? "token-grid" : "choice-list"}>{choices.map((choice, index) => { const active = exercise.type === "sentence_builder" ? tokens.includes(choice) : selected === choice; const revealClass = checked && normalizeAnswer(choice) === normalizeAnswer(exercise.payload.answer) ? "correct" : checked && active && !correct ? "incorrect" : ""; return <button type="button" className={`${active ? "selected" : ""} ${revealClass}`} key={choice} onClick={() => select(choice)} disabled={checked} aria-pressed={active}><span>{exercise.type === "sentence_builder" ? choice : String.fromCharCode(65 + index)}</span>{exercise.type !== "sentence_builder" && <strong>{choice}</strong>}{checked && normalizeAnswer(choice) === normalizeAnswer(exercise.payload.answer) && <i aria-hidden="true">✓</i>}</button>; })}</div>
    {checked && <><BibataCoach tone={correct ? "success" : "gentle"} title={correct ? "Bien joué" : "On ajuste"} compact announce>{correct ? successCopy : <>La bonne réponse est <b>{exercise.payload.answer}</b>. Relis-la une fois avant de continuer : c’est elle qui compte, pas l’erreur.</>}</BibataCoach><SpeechButton text={exercise.payload.answer} language={language} enabled={soundEnabled} label="Écouter la bonne réponse" /></>}
    <div className="sticky-action"><button className="primary-button" type="button" disabled={!answer} onClick={validateOrContinue}>{checked ? "Continuer" : "Vérifier"}<span>→</span></button></div>
  </section>;
}

function getConversationErrorMessage(error: unknown, isOnline: boolean) {
  if (!isOnline) return "Tu es hors ligne. Reconnecte-toi pour recevoir la réponse de Bibata, puis réessaie.";
  if (!(error instanceof AIProviderError)) return "La conversation est momentanément indisponible. Vérifie ta connexion, puis réessaie.";
  switch (error.code) {
    case "MAMMOUTH_NOT_CONFIGURED":
    case "MAMMOUTH_AUTH_FAILED": return "Le service de conversation n’est pas correctement configuré.";
    case "MAMMOUTH_RATE_LIMITED": return "Le service reçoit trop de demandes. Patiente un instant, puis réessaie.";
    case "AI_BUDGET_REACHED": return "La limite de conversations a été atteinte pour le moment. Reviens dans quelques minutes.";
    case "MAMMOUTH_TIMEOUT": return "La réponse prend trop de temps. Réessaie dans un instant.";
    case "MAMMOUTH_INVALID_RESPONSE":
    case "INVALID_API_RESPONSE": return "Le service a renvoyé une réponse inutilisable. Tu peux réessayer.";
    default: return "La conversation est momentanément indisponible. Vérifie ta connexion, puis réessaie.";
  }
}

function getPlanErrorMessage(error: unknown, isOnline: boolean) {
  if (!isOnline) return "Reconnecte-toi pour que Bibata puisse composer un parcours personnel.";
  if (!(error instanceof AIProviderError)) return "Le service de planification est momentanément indisponible. Tu peux réessayer.";
  switch (error.code) {
    case "MAMMOUTH_NOT_CONFIGURED":
    case "MAMMOUTH_AUTH_FAILED": return "Le service de planification n’est pas correctement configuré.";
    case "MAMMOUTH_RATE_LIMITED": return "Le service reçoit beaucoup de demandes. Patiente un instant, puis réessaie.";
    case "AI_BUDGET_REACHED": return "La limite de préparation a été atteinte pour le moment. Réessaie dans quelques minutes.";
    case "MAMMOUTH_TIMEOUT": return "La préparation prend trop de temps. Réessaie dans un instant.";
    case "MAMMOUTH_INVALID_PLAN":
    case "MAMMOUTH_INVALID_RESPONSE":
    case "INVALID_API_RESPONSE": return "Le parcours reçu n’était pas utilisable. Bibata peut en recomposer un nouveau.";
    default: return "Le service de planification est momentanément indisponible. Tu peux réessayer.";
  }
}

function ConversationStage({ mission, level, isOnline, onComplete }: { mission: Mission; level: CEFRLevel; isOnline: boolean; onComplete: (usedConceptIds: string[]) => void }) {
  const opening = getDirectConversationOpening(mission.conversation.opening);
  const [messages, setMessages] = useState<ConversationMessage[]>([{ id: "opening", role: "character", text: opening }]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [aiError, setAiError] = useState("");
  const messageId = useRef(0);
  const requestInFlight = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const completedTurns = countCompletedConversationTurns(messages);
  const availableReplies = getAvailableConversationReplies(mission.conversation.suggestedReplies, messages);
  const usedConceptIds = findConceptsUsedByLearner(mission.conceptIds.map((id) => ({ id, value: getConcept(id)?.value ?? "" })), messages);
  const usedConceptSet = new Set(usedConceptIds);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, waiting, aiError]);

  const requestReply = async (conversationMessages: ConversationMessage[]) => {
    if (requestInFlight.current) return;
    if (!isOnline) { setAiError(getConversationErrorMessage(undefined, false)); return; }
    requestInFlight.current = true;
    setWaiting(true);
    setAiError("");
    try {
      const response = await aiProvider.generateConversationTurn(mission.conversation, conversationMessages, level);
      setMessages((current) => [...current, response]);
      playUISound("message");
    } catch (error) {
      setAiError(getConversationErrorMessage(error, isOnline));
    } finally {
      requestInFlight.current = false;
      setWaiting(false);
    }
  };

  const send = async (value: string) => {
    const text = value.trim();
    if (!text || requestInFlight.current) return;
    messageId.current += 1;
    const learnerMessage: ConversationMessage = { id: `learner-${messageId.current}`, role: "learner", text };
    const next = [...messages, learnerMessage];
    setMessages(next);
    setDraft("");
    setAiError("");
    playUISound("send");
    await requestReply(next);
  };

  return <section className="conversation-stage"><div className="scenario-card"><span className="scenario-avatar" aria-hidden="true"><Image src={mascotAvatar} alt="" sizes="47px" /></span><div><small>Situation réelle · Niveau {level}</small><h1>{mission.conversation.title}</h1><p>{mission.conversation.setting}</p></div><div className="scenario-instructions"><strong>Ton défi avec Bibata</strong><p>Utilise ces expressions quand elles ont vraiment du sens dans l’échange.</p><div className="objective-pills">{mission.conversation.objectives.map((item, index) => { const used = usedConceptSet.has(mission.conceptIds[index]); return <span key={item} className={used ? "done" : ""}>{used ? "✓" : index + 1} {item}</span>; })}</div></div></div>
    <div className="chat-window" aria-live="polite">{messages.map((message) => <div className={`message ${message.role}`} key={message.id}>{message.role === "character" && <small>{mission.conversation.characterName}</small>}<p>{parseMessageText(message.text).map((part, index) => part.bold ? <strong key={index}>{part.text}</strong> : part.text)}</p></div>)}{waiting && <div className="typing" role="status"><span className="typing-avatar" aria-hidden="true">{mission.conversation.characterName.charAt(0)}</span><span className="typing-copy"><strong>{mission.conversation.characterName} réfléchit</strong><small>La conversation continue</small></span><span className="typing-dots" aria-hidden="true"><i /><i /><i /></span></div>}<div ref={chatEndRef} /></div>
    {completedTurns >= 3 && <BibataCoach tone="success" title="Échange terminé" compact announce>Tu as tenu la conversation jusqu’au bout. Je t’ai préparé un bilan clair.</BibataCoach>}
    {completedTurns >= 3 ? <div className="sticky-action"><button className="primary-button" type="button" onClick={() => onComplete(usedConceptIds)}>Voir mon bilan <span>→</span></button></div> : <div className="chat-composer">{aiError && <div className="conversation-error" role="alert"><div><strong>Impossible de poursuivre la conversation</strong><p>{aiError}</p></div><button type="button" onClick={() => void requestReply(messages)} disabled={waiting || !isOnline}>Réessayer</button></div>}{!waiting && availableReplies.length > 0 && <div className="reply-suggestions" aria-label="Réponses suggérées">{availableReplies.map((reply) => <button type="button" key={reply} onClick={() => void send(reply)}>{reply}</button>)}</div>}<form className="chat-input" onSubmit={(event) => { event.preventDefault(); void send(draft); }}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={waiting ? "Bibata te répond…" : "Écris ta réponse…"} aria-label="Ta réponse" autoComplete="off" disabled={waiting} /><button type="submit" disabled={waiting || !draft.trim()} aria-label="Envoyer">↑</button></form></div>}
  </section>;
}

function MissionFlow({ mission, level, isOnline, soundEnabled, onEngaged, onExit, onFinish }: { mission: Mission; level: CEFRLevel; isOnline: boolean; soundEnabled: boolean; onEngaged: () => void; onExit: () => void; onFinish: (attempts: ExerciseAttempt[], score: MissionScore) => void }) {
  const isConsolidation = mission.kind === "consolidation";
  const [stage, setStage] = useState<MissionStage>("intro");
  const [conceptIndex, setConceptIndex] = useState(0);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [attempts, setAttempts] = useState<ExerciseAttempt[]>([]);
  const [score, setScore] = useState<MissionScore>({ total: 0, concepts: 0, comprehension: 0, usage: 0 });
  const [assimilatedConceptIds, setAssimilatedConceptIds] = useState<string[]>([]);
  const [exitConfirm, setExitConfirm] = useState(false);
  const missionConcepts = mission.conceptIds.map((id) => getConcept(id)).filter((item) => item !== undefined);
  const concept = missionConcepts[conceptIndex];
  const conceptVisual = concept ? getContextVisual(concept.categories) : undefined;
  const progressMap: Record<MissionStage, number> = { intro: 4, discover: 20 + conceptIndex * 6, context: 48, exercise: 55 + exerciseIndex * 10, conversation: 88, result: 100 };
  const requestExit = () => { if (stage === "intro") onExit(); else setExitConfirm(true); };
  const beginMission = () => { playUISound("transition"); onEngaged(); setStage("discover"); };
  const advanceConcept = () => { playUISound("transition"); if (conceptIndex < missionConcepts.length - 1) setConceptIndex((index) => index + 1); else { setConceptIndex(0); setStage("context"); } };
  const recordAnswer = (answer: string, correct: boolean) => {
    const exercise = mission.exercises[exerciseIndex];
    const modes: ExerciseAttempt["mode"][] = ["recognition", "context", "production"];
    const nextAttempt: ExerciseAttempt = { exerciseId: exercise.id, conceptIds: exercise.concepts, correct, response: answer, mode: modes[exerciseIndex] ?? "recall", answeredAt: Date.now() };
    const next = [...attempts, nextAttempt];
    setAttempts(next);
    if (exerciseIndex < mission.exercises.length - 1) setExerciseIndex((index) => index + 1);
    else setStage("conversation");
  };
  const completeConversation = (usedConceptIds: string[]) => {
    const answeredAt = Date.now();
    const conversationAttempts: ExerciseAttempt[] = usedConceptIds.map((conceptId) => ({ exerciseId: `${mission.id}-conversation-${conceptId}`, conceptIds: [conceptId], correct: true, response: "used in conversation", mode: "production", source: "conversation", answeredAt }));
    const completeAttempts = [...attempts, ...conversationAttempts];
    setAttempts(completeAttempts);
    setAssimilatedConceptIds(usedConceptIds);
    setScore(calculateMissionScore(completeAttempts));
    playUISound("complete");
    setStage("result");
  };

  let screen: ReactNode;
  if (stage === "intro") screen = <main className="mission-shell intro-screen page-enter"><MissionHeader progress={progressMap[stage]} onClose={requestExit} /><section className="mission-intro"><div className="mission-guide-portrait" aria-hidden="true"><span>✦</span><Image src={mascotAvatar} alt="" sizes="150px" /><i /><i /></div><p className="eyebrow">Mission {mission.order} · {mission.eyebrow}</p><h1>{mission.title}</h1><p>{mission.description}</p><div className="mission-meta"><span>◷ {mission.durationMinutes} min</span><span>{isConsolidation ? "↻" : "＋"} {mission.conceptIds.length} expression{mission.conceptIds.length > 1 ? "s" : ""} {isConsolidation ? "à pratiquer" : "à apprendre"}</span><span>Niveau {level}</span></div></section><div className="sticky-action"><button className="primary-button" type="button" onClick={beginMission}>Commencer <span>→</span></button></div></main>;
  else if (stage === "discover" && concept && conceptVisual) screen = <main className="mission-shell page-enter"><MissionHeader progress={progressMap[stage]} onClose={requestExit} /><section className="concept-stage"><p className="eyebrow">{isConsolidation ? "Expression à réactiver" : "Nouveau concept"} · {conceptIndex + 1} sur {missionConcepts.length}</p><div className="concept-visual contextual"><Image src={conceptVisual.src} alt={conceptVisual.alt} fill unoptimized sizes="(min-width: 700px) 360px, calc(100vw - 48px)" /><span className="context-visual-shade" aria-hidden="true" /></div><h1>{concept.value}</h1><p className="translation">{concept.translation}</p><SpeechButton text={concept.value} language={concept.language} enabled={soundEnabled} /></section><div className="sticky-action"><button className="primary-button" type="button" onClick={advanceConcept}>{isConsolidation ? "Je m’en souviens" : "J’ai compris"} <span>→</span></button></div></main>;
  else if (stage === "context" && concept) screen = <main className="mission-shell page-enter"><MissionHeader progress={progressMap[stage]} onClose={requestExit} /><section className="context-stage"><p className="eyebrow">En contexte</p><div className="quote-mark">“</div><blockquote>{concept.examples[0].text}</blockquote><p>{concept.examples[0].translation}</p><SpeechButton text={concept.examples[0].text} language={concept.language} enabled={soundEnabled} label="Écouter la phrase" /></section><div className="sticky-action"><button className="primary-button" type="button" onClick={() => { playUISound("transition"); setStage("exercise"); }}>À moi de jouer <span>→</span></button></div></main>;
  else if (stage === "exercise") screen = <main className="mission-shell"><MissionHeader progress={progressMap[stage]} onClose={requestExit} /><ExerciseCard key={mission.exercises[exerciseIndex].id} exercise={mission.exercises[exerciseIndex]} language={missionConcepts[0]?.language ?? "en"} soundEnabled={soundEnabled} onAnswer={recordAnswer} /></main>;
  else if (stage === "conversation") screen = <main className="mission-shell conversation-shell"><MissionHeader progress={progressMap[stage]} onClose={requestExit} /><ConversationStage mission={mission} level={level} isOnline={isOnline} onComplete={completeConversation} /></main>;
  else screen = <main className="mission-shell result-screen page-enter"><section className="result-hero"><div className="result-mascot" aria-hidden="true"><Image src={mascot} alt="" sizes="150px" /><span>✓</span><i /><i /></div><p className="eyebrow">Mission {mission.order} terminée</p><h1>Beau travail !</h1><p>{isConsolidation ? (assimilatedConceptIds.length ? `Tu as réutilisé ${assimilatedConceptIds.length} expression${assimilatedConceptIds.length > 1 ? "s" : ""} avec justesse dans un nouveau contexte.` : "Tu as terminé cette nouvelle situation. Les expressions moins naturelles reviendront dans d’autres contextes.") : (assimilatedConceptIds.length ? `Tu as utilisé ${assimilatedConceptIds.length} concept${assimilatedConceptIds.length > 1 ? "s" : ""} avec justesse dans une vraie conversation.` : "Tu as terminé l’échange. Les concepts non utilisés avec un sens clair reviendront pour être assimilés.")}</p></section><div className="score-card"><div className="score-total"><span><strong>{score.total}</strong>/100</span><p>Score global</p></div>{(["concepts", "comprehension", "usage"] as const).map((item) => <div className="score-row" key={item}><span>{item === "concepts" ? "Concepts" : item === "comprehension" ? "Compréhension" : "Utilisation"}</span><ProgressLine value={score[item]} label={`Score ${item}`} /><strong>{score[item]}%</strong></div>)}</div><div className="learned-banner"><span>{isConsolidation ? "↗" : "＋"}{assimilatedConceptIds.length}</span><div><strong>{isConsolidation ? `expression${assimilatedConceptIds.length > 1 ? "s" : ""} consolidée${assimilatedConceptIds.length > 1 ? "s" : ""}` : `concept${assimilatedConceptIds.length > 1 ? "s" : ""} assimilé${assimilatedConceptIds.length > 1 ? "s" : ""}`}</strong><p>{isConsolidation ? "La pratique renforce tes acquis sans les compter comme nouveaux." : "Présence, cohérence et sens sont vérifiés avant validation."}</p></div></div><div className="sticky-action"><button className="primary-button" type="button" onClick={() => onFinish(attempts, score)}>Revenir à l’accueil <span>→</span></button></div></main>;

  return <>{screen}{exitConfirm && <ConfirmDialog title="Quitter cette mission ?" description="Ta progression dans cette mission ne sera pas enregistrée." confirmLabel="Quitter" onCancel={() => setExitConfirm(false)} onConfirm={onExit} />}</>;
}

export default function BibataApp() {
  const [state, setState] = useState<PersistedState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("onboarding-language");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>("A1");
  const [activeMission, setActiveMission] = useState<Mission>(missions[0]);
  const [notice, setNotice] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [planning, setPlanning] = useState<PlanningState>(null);
  const [showPlanningScreen, setShowPlanningScreen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [accountRequiredOpen, setAccountRequiredOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean>();
  const [onboardingPlanError, setOnboardingPlanError] = useState("");
  const [planIssue, setPlanIssue] = useState("");
  const noticeTimer = useRef<number | undefined>(undefined);
  const migrationAttempts = useRef(new Set<string>());
  const nextMissionRequest = useRef<Promise<Mission | undefined> | null>(null);
  const onboardingSeed = useRef("");
  const pwa = usePWA();
  const audio = useAudio();
  const installNudgeDismissed = useSyncExternalStore(subscribeToInstallNudge, getInstallNudgeSnapshot, getInstallNudgeServerSnapshot);
  const accountNudgeDismissed = useSyncExternalStore(subscribeToAccountNudge, getAccountNudgeSnapshot, getAccountNudgeServerSnapshot);
  const planningPlan = planning !== null;
  const profile = state.profiles.find((item) => item.language === (state.activeLanguage ?? "en"));
  const activeProfileId = profile?.id;
  const currentLevel = profile?.estimatedLevel ?? selectedLevel;
  const assimilatedConceptIds = useMemo(() => getAssimilatedConceptIds(state.mastery), [state.mastery]);
  const levelMissions = useMemo(() => getMissionsForProfile(profile, currentLevel, assimilatedConceptIds), [assimilatedConceptIds, currentLevel, profile]);
  const learnedCount = useMemo(() => Object.values(state.mastery).filter((item) => isConceptAssimilated(item) && getConcept(item.conceptId)?.level === currentLevel).length, [currentLevel, state.mastery]);
  const billingActiveMissionId = useMemo(() => {
    const now = new Date();
    return Object.values(state.missionProgress)
      .filter((item) => item.status === "completed" && item.completedAt && new Date(item.completedAt).getUTCFullYear() === now.getUTCFullYear() && new Date(item.completedAt).getUTCMonth() === now.getUTCMonth())
      .sort((left, right) => (left.completedAt ?? 0) - (right.completedAt ?? 0))
      .at(-1)?.missionId;
  }, [state.missionProgress]);
  const effectivePlanIssue = planIssue || (!loading && profile && !profile.learningPlan && !pwa.isOnline ? getPlanErrorMessage(undefined, false) : "");

  const notify = (message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3_000);
  };

  useEffect(() => {
    storageRepository.getState().then((saved) => {
      const params = new URLSearchParams(window.location.search);
      const openSettings = params.get("onglet") === "reglages" || params.has("paiement");
      setState(saved);
      setView(openSettings && saved.profiles.length ? "settings" : saved.profiles.length ? "home" : "onboarding-language");
      const auth = params.get("auth");
      if (auth === "connecte" || auth === "erreur") {
        setNotice(auth === "connecte" ? "Compte Google connecté" : "La connexion Google n’a pas abouti");
        noticeTimer.current = window.setTimeout(() => setNotice(""), 3_000);
      }
      if (openSettings) window.history.replaceState({}, "", window.location.pathname);
      setLoading(false);
      void mergeFromCloud(saved).then(async (merged) => {
        if (JSON.stringify(merged) === JSON.stringify(saved)) return;
        setState(merged);
        await storageRepository.saveState(merged);
      });
    });
    return () => window.clearTimeout(noticeTimer.current);
  }, []);

  useEffect(() => {
    if (!activeProfileId) return;
    let cancelled = false;
    fetch("/api/auth/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { authenticated?: boolean }) => { if (!cancelled) setAuthenticated(Boolean(payload.authenticated)); })
      .catch(() => { if (!cancelled) setAuthenticated(undefined); });
    return () => { cancelled = true; };
  }, [activeProfileId]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setShowPlanningScreen(planning?.mode === "foreground"),
      planning?.mode === "foreground" ? 280 : 0,
    );
    return () => window.clearTimeout(timer);
  }, [planning]);

  useEffect(() => {
    if (loading || !profile || profile.learningPlan || !pwa.isOnline || (profile.completedMissionIds.length > 0 && authenticated !== true)) return;
    const attemptKey = `${profile.id}-${profile.estimatedLevel ?? "A1"}`;
    if (migrationAttempts.current.has(attemptKey)) return;
    migrationAttempts.current.add(attemptKey);
    setPlanning({ mode: "foreground", task: "migration" });
    setPlanIssue("");
    const migrate = async () => {
      try {
        const level = profile.estimatedLevel ?? "A1";
        const migrationSeed = `migration-${profile.id}-${level}`.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 80);
        const plan = await aiProvider.generateLearningPlan(level, profile.interests, migrationSeed, getAssimilatedConceptIds(state.mastery));
        const personalizedMissions = buildMissionsFromPlan(plan);
        const saved = await storageRepository.getState();
        const savedProfile = saved.profiles.find((item) => item.id === profile.id);
        if (!savedProfile || savedProfile.learningPlan) return;
        const nextProfile = { ...savedProfile, learningPlan: plan, currentMissionId: personalizedMissions[0].id, updatedAt: Date.now() };
        const nextState = { ...saved, profiles: saved.profiles.map((item) => item.id === profile.id ? nextProfile : item) };
        setState(nextState);
        await storageRepository.saveState(nextState);
      } catch (error) {
        setPlanIssue(getPlanErrorMessage(error, pwa.isOnline));
      } finally {
        setPlanning(null);
      }
    };
    void migrate();
  }, [authenticated, loading, profile, pwa.isOnline, state.mastery]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  const chooseLanguage = (code: string) => { setSelectedLanguage(code); setView("onboarding-level"); };
  const finishOnboarding = async (interests: string[]) => {
    if (!pwa.isOnline) {
      setOnboardingPlanError(getPlanErrorMessage(undefined, false));
      return;
    }
    setPlanning({ mode: "foreground", task: "first-plan" });
    setOnboardingPlanError("");
    const language = languages.find((item) => item.code === selectedLanguage) ?? languages[0];
    try {
      if (!onboardingSeed.current) onboardingSeed.current = crypto.randomUUID();
      const plan = await aiProvider.generateLearningPlan(selectedLevel, interests, onboardingSeed.current);
      const onboardingMissions = buildMissionsFromPlan(plan);
      const now = Date.now();
      const newProfile: LearningProfile = { id: `local-${selectedLanguage}`, language: selectedLanguage, languageName: language.name, languageFlag: language.flag, estimatedLevel: selectedLevel, levelConfidence: 1, interests, ability: initialAbility, currentMissionId: onboardingMissions[0].id, completedMissionIds: [], learningPlan: plan, createdAt: now, updatedAt: now };
      const nextState = { ...state, profiles: [...state.profiles.filter((item) => item.language !== selectedLanguage), newProfile], activeLanguage: selectedLanguage };
      setState(nextState);
      await storageRepository.saveState(nextState);
      setActiveMission(onboardingMissions[0]);
      setPlanIssue("");
      setView("mission");
    } catch (error) {
      setOnboardingPlanError(getPlanErrorMessage(error, pwa.isOnline));
    } finally {
      setPlanning(null);
    }
  };
  function extendPersonalPlan(profileSnapshot: LearningProfile, mode: "foreground" | "background" = "background"): Promise<Mission | undefined> {
    if (nextMissionRequest.current) return nextMissionRequest.current;
    if (!profileSnapshot.learningPlan) return Promise.resolve(undefined);
    if (!pwa.isOnline) {
      setPlanIssue(getPlanErrorMessage(undefined, false));
      return Promise.resolve(undefined);
    }
    const sourcePlan = profileSnapshot.learningPlan;
    const request: Promise<Mission | undefined> = (async () => {
      setPlanning({ mode, task: "next-mission" });
      setPlanIssue("");
      try {
        const latestBeforeRequest = await storageRepository.getState();
        const excludedConceptIds = [...new Set([
          ...getAssimilatedConceptIds(latestBeforeRequest.mastery),
          ...sourcePlan.missions.flatMap((mission) => mission.conceptIds),
        ])];
        const generated = await aiProvider.generateNextMission(sourcePlan, profileSnapshot.interests, excludedConceptIds);
        const saved = await storageRepository.getState();
        const latestProfile = saved.profiles.find((item) => item.id === profileSnapshot.id);
        const latestPlan = latestProfile?.learningPlan;
        if (!latestProfile || !latestPlan || latestPlan.id !== sourcePlan.id) return undefined;
        const existing = latestPlan.missions.find((mission) => mission.id === generated.id || mission.order === generated.order);
        const nextPlan = existing
          ? latestPlan
          : { ...latestPlan, missions: [...latestPlan.missions, generated].sort((left, right) => left.order - right.order) };
        const runtimeMissions = buildMissionsFromPlan(nextPlan, getAssimilatedConceptIds(saved.mastery));
        const runtimeMission = runtimeMissions.find((mission) => mission.id === (existing?.id ?? generated.id));
        if (!runtimeMission || existing) return runtimeMission;
        const currentMissionStillAvailable = runtimeMissions.find((mission) => mission.id === latestProfile.currentMissionId && !latestProfile.completedMissionIds.includes(mission.id));
        const nextProfile: LearningProfile = {
          ...latestProfile,
          learningPlan: nextPlan,
          currentMissionId: currentMissionStillAvailable?.id ?? runtimeMission.id,
          updatedAt: Date.now(),
        };
        const nextState = { ...saved, profiles: saved.profiles.map((item) => item.id === latestProfile.id ? nextProfile : item) };
        setState(nextState);
        await storageRepository.saveState(nextState);
        return runtimeMission;
      } catch (error) {
        setPlanIssue(getPlanErrorMessage(error, pwa.isOnline));
        return undefined;
      } finally {
        nextMissionRequest.current = null;
        setPlanning(null);
      }
    })();
    nextMissionRequest.current = request;
    return request;
  }
  const requireAccountForProgress = async () => {
    if (!profile?.completedMissionIds.length) return true;
    try {
      const response = await fetch("/api/auth/status", { cache: "no-store" });
      const payload = await response.json() as { authenticated?: boolean };
      if (payload.authenticated) {
        setAuthenticated(true);
        return true;
      }
    } catch {
      // Le dialogue explique l’étape suivante même si la vérification réseau échoue.
    }
    setAuthenticated(false);
    setAccountRequiredOpen(true);
    return false;
  };
  const startMission = async () => {
    if (!profile) return;
    if (!await requireAccountForProgress()) return;
    const unfinished = levelMissions.filter((mission) => !profile.completedMissionIds.includes(mission.id));
    let nextMission: Mission | undefined = unfinished[0];
    if (!nextMission) nextMission = await extendPersonalPlan(profile, "foreground");
    if (!nextMission) return;
    setActiveMission(nextMission);
    setView("mission");
  };
  const changeLevel = async (level: CEFRLevel) => {
    if (!profile) return;
    if (!await requireAccountForProgress()) return;
    if (!pwa.isOnline) { setPlanIssue(getPlanErrorMessage(undefined, false)); notify("Connexion nécessaire pour changer de parcours"); return; }
    setPlanning({ mode: "foreground", task: "recompose" });
    setPlanIssue("");
    try {
      const plan = await aiProvider.generateLearningPlan(level, profile.interests, crypto.randomUUID(), assimilatedConceptIds);
      const nextLevelMissions = buildMissionsFromPlan(plan, assimilatedConceptIds);
      const nextMission = nextLevelMissions[0];
      if (!nextMission) throw new Error("Le parcours généré ne contient aucune mission");
      const nextProfile = { ...profile, estimatedLevel: level, levelConfidence: 1, learningPlan: plan, currentMissionId: nextMission.id, updatedAt: Date.now() };
      const nextState = { ...state, profiles: state.profiles.map((item) => item.id === profile.id ? nextProfile : item) };
      setState(nextState);
      setActiveMission(nextMission);
      await storageRepository.saveState(nextState);
      notify(`Niveau ${level} appliqué · parcours personnel prêt`);
    } catch (error) {
      const message = getPlanErrorMessage(error, pwa.isOnline);
      setPlanIssue(message);
      notify("Le niveau n’a pas été modifié");
    } finally {
      setPlanning(null);
    }
  };
  const recomposePlan = async () => {
    if (!profile || planningPlan) return;
    if (!await requireAccountForProgress()) return;
    if (!pwa.isOnline) { setPlanIssue(getPlanErrorMessage(undefined, false)); return; }
    setPlanning({ mode: "foreground", task: "recompose" });
    setPlanIssue("");
    const level = profile.estimatedLevel ?? "A1";
    try {
      const plan = await aiProvider.generateLearningPlan(level, profile.interests, crypto.randomUUID(), assimilatedConceptIds);
      const personalizedMissions = buildMissionsFromPlan(plan, assimilatedConceptIds);
      if (!personalizedMissions[0]) throw new Error("Le parcours généré ne contient aucune mission");
      const nextProfile = { ...profile, learningPlan: plan, currentMissionId: personalizedMissions[0].id, updatedAt: Date.now() };
      const nextState = { ...state, profiles: state.profiles.map((item) => item.id === profile.id ? nextProfile : item) };
      setState(nextState);
      setActiveMission(personalizedMissions[0]);
      await storageRepository.saveState(nextState);
      notify("Un nouveau parcours personnel est prêt");
    } catch (error) {
      setPlanIssue(getPlanErrorMessage(error, pwa.isOnline));
    } finally {
      setPlanning(null);
    }
  };
  const finishMission = async (attempts: ExerciseAttempt[], score: MissionScore) => {
    if (!profile) return;
    const saved = await storageRepository.getState();
    const latestProfile = saved.profiles.find((item) => item.id === profile.id) ?? profile;
    const nextMastery = { ...saved.mastery };
    for (const attempt of attempts) for (const conceptId of attempt.conceptIds) nextMastery[conceptId] = updateConceptMastery(nextMastery[conceptId], { ...attempt, conceptIds: [conceptId] });
    for (const conceptId of activeMission.conceptIds) if (!nextMastery[conceptId]) nextMastery[conceptId] = { ...createEmptyMastery(conceptId), exposureCount: 1, recognition: 0.08, masteryScore: 0.02, confidence: 0.15, lastSeenAt: Date.now() };
    const completedMissionIds = [...new Set([...latestProfile.completedMissionIds, activeMission.id])];
    const currentLevelMissions = getMissionsForProfile(latestProfile, latestProfile.estimatedLevel ?? "A1", getAssimilatedConceptIds(nextMastery));
    const remainingMissions = currentLevelMissions.filter((mission) => !completedMissionIds.includes(mission.id));
    const nextProfile: LearningProfile = { ...latestProfile, completedMissionIds, currentMissionId: remainingMissions[0]?.id, updatedAt: Date.now() };
    const nextState: PersistedState = { ...saved, mastery: nextMastery, profiles: saved.profiles.map((item) => item.id === latestProfile.id ? nextProfile : item), missionProgress: { ...saved.missionProgress, [activeMission.id]: { missionId: activeMission.id, status: "completed", score: score.total, completedAt: Date.now() } } };
    setState(nextState);
    await storageRepository.saveState(nextState);
    void fetch("/api/billing/activity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ missionId: activeMission.id }), keepalive: true }).catch(() => undefined);
    setView("home");
    notify("Mission enregistrée");
  };
  const reset = async () => {
    await storageRepository.reset();
    setState(structuredClone(emptyState));
    setSelectedLanguage("en");
    setSelectedLevel("A1");
    setOnboardingPlanError("");
    setPlanIssue("");
    onboardingSeed.current = "";
    setResetConfirm(false);
    setView("onboarding-language");
  };
  const importData = async (value: string) => {
    try {
      const imported = await storageRepository.importJSON(value);
      setState(imported);
      setView(imported.profiles.length ? "home" : "onboarding-language");
      notify("Progression restaurée");
    } catch {
      notify("Cette sauvegarde n’est pas valide");
    }
  };
  const dismissInstallNudge = () => {
    window.localStorage.setItem(INSTALL_NUDGE_KEY, String(Date.now()));
    window.dispatchEvent(new Event(INSTALL_NUDGE_EVENT));
  };
  const dismissAccountNudge = () => {
    window.localStorage.setItem(ACCOUNT_NUDGE_KEY, String(Date.now()));
    window.dispatchEvent(new Event(ACCOUNT_NUDGE_EVENT));
  };
  const installApp = async () => {
    if (!pwa.canInstall) {
      setInstallGuideOpen(true);
      return;
    }
    if (await pwa.install()) notify("Bibata a été ajoutée à ton appareil");
  };

  const showOnboardingInstallInvite = !pwa.isInstalled;

  let content: ReactNode;
  if (loading) content = <main className="loading-screen"><Logo /><span className="loading-dot" /><p>Ouverture de Bibata…</p></main>;
  else if (planning?.mode === "foreground" && showPlanningScreen) content = <AIWaitingScreen task={planning.task} level={currentLevel} />;
  else if (view === "onboarding-language") content = <OnboardingLanguage showInstallInvite={showOnboardingInstallInvite} installPlatform={pwa.platform} canInstall={pwa.canInstall} onInstall={() => void installApp()} onChoose={chooseLanguage} />;
  else if (view === "onboarding-level") content = <OnboardingLevel selected={selectedLevel} onBack={() => setView("onboarding-language")} onSelect={setSelectedLevel} onContinue={() => setView("onboarding-interests")} />;
  else if (view === "onboarding-interests") content = <OnboardingInterests loading={planningPlan} error={onboardingPlanError} onBack={() => setView("onboarding-level")} onContinue={(interests) => void finishOnboarding(interests)} />;
  else if (view === "mission") content = <MissionFlow key={`${activeMission.id}-${profile?.estimatedLevel ?? selectedLevel}`} mission={activeMission} level={profile?.estimatedLevel ?? selectedLevel} isOnline={pwa.isOnline} soundEnabled={audio.enabled} onEngaged={() => { if (profile?.learningPlan && authenticated === true) void extendPersonalPlan(profile); }} onExit={() => setView(profile ? "home" : "onboarding-interests")} onFinish={(attempts, score) => void finishMission(attempts, score)} />;
  else if (!profile) content = <OnboardingLanguage showInstallInvite={showOnboardingInstallInvite} installPlatform={pwa.platform} canInstall={pwa.canInstall} onInstall={() => void installApp()} onChoose={chooseLanguage} />;
  else if (view === "progress") content = <ProgressScreen profile={profile} availableMissions={levelMissions} masteryCount={learnedCount} onContinue={() => void startMission()} onNavigate={setView} />;
  else if (view === "settings") content = <SettingsScreen key={`${pwa.isOnline}-${pwa.offlineReady}-${pwa.canInstall}-${pwa.isInstalled}-${pwa.platform}`} profile={profile} mastery={state.mastery} billingActiveMissionId={billingActiveMissionId} pwa={pwa} soundEnabled={audio.enabled} planningPlan={planningPlan} onInstall={() => void installApp()} onToggleSound={audio.toggle} onNavigate={setView} onNotify={notify} onResetRequest={() => setResetConfirm(true)} onImport={(value) => void importData(value)} onLevelChange={(level) => void changeLevel(level)} onReplan={() => void recomposePlan()} />;
  else content = <HomeScreen profile={profile} availableMissions={levelMissions} learnedCount={learnedCount} showInstallNudge={pwa.canSuggestInstall && !installNudgeDismissed} showAccountNudge={profile.completedMissionIds.length > 0 && authenticated === false && !accountNudgeDismissed} installPlatform={pwa.platform} offlineReady={pwa.offlineReady} planningPlan={planningPlan} planIssue={effectivePlanIssue} onContinue={() => void startMission()} onRetry={() => void recomposePlan()} onInstall={() => void installApp()} onDismissInstall={dismissInstallNudge} onDismissAccount={dismissAccountNudge} onNavigate={setView} />;

  return <>{!pwa.isOnline && <div className="network-banner" role="status"><span aria-hidden="true">○</span>Mode hors ligne · les conversations IA nécessitent une connexion</div>}{content}{notice && <Toast message={notice} />}{installGuideOpen && <InstallGuideDialog platform={pwa.platform} onClose={() => setInstallGuideOpen(false)} />}{accountRequiredOpen && <AccountRequiredDialog onClose={() => setAccountRequiredOpen(false)} />}{resetConfirm && <ConfirmDialog title="Tout recommencer ?" description="Tous les profils, missions et résultats enregistrés sur cet appareil seront effacés." confirmLabel="Tout effacer" onCancel={() => setResetConfirm(false)} onConfirm={() => void reset()} />}</>;
}
