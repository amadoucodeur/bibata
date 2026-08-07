"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AIProviderError, aiProvider } from "@/ai/provider";
import { countCompletedConversationTurns } from "@/core/conversation";
import { calculateMissionScore, createEmptyMastery, getNextMission, updateConceptMastery } from "@/core/learning-engine";
import { getConcept, interestOptions, languages, missions, roadmap } from "@/data/curriculum";
import { emptyState, storageRepository } from "@/storage/repository";
import { usePWA } from "@/features/usePWA";
import {
  CEFR_LEVELS,
  type CEFRLevel,
  type ConversationMessage,
  type Exercise,
  type ExerciseAttempt,
  type LearningProfile,
  type Mission,
  type MissionScore,
  type PersistedState,
} from "@/types/learning";

type View = "onboarding-language" | "onboarding-level" | "onboarding-interests" | "home" | "progress" | "settings" | "mission";
type MissionStage = "intro" | "discover" | "context" | "exercise" | "conversation" | "result";

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

const Logo = () => <span className="brand" aria-label="Bibata"><span className="brand-mark" aria-hidden="true">b</span><span>Bibata</span></span>;

function ProgressLine({ value, label = "Progression" }: { value: number; label?: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return <span className="progress-line" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}><span style={{ width: `${safeValue}%` }} /></span>;
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

function OnboardingLanguage({ onChoose }: { onChoose: (code: string) => void }) {
  return <main className="onboarding-shell page-enter">
    <header className="onboarding-header"><Logo /><span className="step-count">1 sur 3</span></header>
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
    <section className="onboarding-copy compact"><p className="eyebrow">À ton rythme</p><h1>Où en es-tu<br />aujourd’hui ?</h1><p>Ce choix adapte immédiatement la difficulté des conversations. Tu pourras le modifier à tout moment.</p></section>
    <div className="level-options" aria-label="Choisir un niveau CECR">
      {CEFR_LEVELS.map((level) => { const active = level === selected; return <button key={level} type="button" className={active ? "selected" : ""} aria-pressed={active} onClick={() => onSelect(level)}><span>{level}</span><div><strong>{levelDescriptions[level]}</strong><small>{levelHints[level]}</small></div><i aria-hidden="true">{active ? "✓" : ""}</i></button>; })}
    </div>
    <div className="sticky-action"><button className="primary-button" type="button" onClick={onContinue}>Continuer <span>→</span></button></div>
  </main>;
}

function OnboardingInterests({ onBack, onContinue }: { onBack: () => void; onContinue: (interests: string[]) => void }) {
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
    <div className="sticky-action"><button className="primary-button" type="button" onClick={() => onContinue(selected)} disabled={selected.length === 0}>Créer mon parcours <span>→</span></button></div>
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

function HomeScreen({ profile, learnedCount, canInstall, offlineReady, onContinue, onInstall, onNavigate }: { profile: LearningProfile; learnedCount: number; canInstall: boolean; offlineReady: boolean; onContinue: () => void; onInstall: () => void; onNavigate: (view: View) => void }) {
  const nextMission = getNextMission(profile, missions) ?? missions[0];
  const completed = profile.completedMissionIds.length;
  const currentWorld = roadmap.worlds[0];
  const currentWorldMissions = currentWorld.missionIds.filter((id) => missions.some((mission) => mission.id === id));
  const completedInWorld = currentWorldMissions.filter((id) => profile.completedMissionIds.includes(id)).length;
  const worldProgress = currentWorldMissions.length ? Math.round((completedInWorld / currentWorldMissions.length) * 100) : 0;
  const ringStyle = { "--ring-progress": `${worldProgress * 3.6}deg` } as CSSProperties;
  return <main className="app-shell page-enter"><AppHeader completedCount={completed} />
    <section className="greeting"><p>Bonjour <span aria-hidden="true">👋</span></p><h1>{completed ? "On garde le rythme ?" : "Prêt·e pour tes premiers mots ?"}</h1></section>
    <div className="home-grid">
      <section className="hero-card" aria-labelledby="next-mission-title"><div className="hero-card-top"><span className="language-pill">{profile.languageFlag} {profile.languageName}</span><span className="hero-level">Niveau {profile.estimatedLevel ?? "A1"}</span></div>
        <div className="level-row"><div><small>Missions terminées</small><strong>{completed}</strong></div><div><small>Concepts rencontrés</small><strong>{learnedCount}</strong></div></div>
        <div className="mission-preview"><span className="mission-number">{String(nextMission.order).padStart(2, "0")}</span><div><small>Prochaine mission · {nextMission.eyebrow}</small><h2 id="next-mission-title">{nextMission.title}</h2><p>Environ {nextMission.durationMinutes} min · {nextMission.conceptIds.length} concepts</p></div></div>
        <button className="primary-button light" type="button" onClick={onContinue}>{completed ? "Continuer mon parcours" : "Commencer ma première mission"}<span>→</span></button></section>
      <div className="home-side">
        <section className="today-strip"><div className="mini-ring" style={ringStyle}><strong>{completedInWorld}</strong><small>/{currentWorldMissions.length}</small></div><div><strong>{currentWorld.title}</strong><p>{worldProgress === 100 ? "Monde terminé — bravo !" : `${worldProgress}% du monde accompli`}</p></div></section>
        <section className="availability-card"><span aria-hidden="true">✦</span><div><strong>Des sessions courtes, sans pression</strong><p>Une mission suffit pour avancer. Ta progression est enregistrée automatiquement.</p></div></section>
        {canInstall && <button type="button" className="install-card" onClick={onInstall}><span aria-hidden="true">↓</span><div><strong>Installer Bibata</strong><small>{offlineReady ? "Accès rapide et interface disponible hors ligne" : "Retrouve Bibata comme une application"}</small></div><i aria-hidden="true">→</i></button>}
      </div>
    </div>
    <BottomNav active="home" onNavigate={onNavigate} />
  </main>;
}

function ProgressScreen({ profile, masteryCount, onContinue, onNavigate }: { profile: LearningProfile; masteryCount: number; onContinue: () => void; onNavigate: (view: View) => void }) {
  const currentLevel = profile.estimatedLevel ?? "A1";
  return <main className="app-shell page-enter"><AppHeader completedCount={profile.completedMissionIds.length} />
    <section className="page-heading"><p className="eyebrow">Ton chemin</p><h1>{profile.languageFlag} {profile.languageName}</h1><p>Une vue claire de ce que tu as déjà parcouru et de la prochaine étape.</p></section>
    <section className="level-card"><div className="level-badge">{currentLevel}</div><div><small>Niveau choisi</small><strong>{levelDescriptions[currentLevel]}</strong><p>Les conversations et le modèle IA s’adaptent à ce niveau.</p></div><button type="button" onClick={() => onNavigate("settings")}>Modifier</button></section>
    <div className="stat-pair"><div><strong>{masteryCount}</strong><span>concepts rencontrés</span></div><div><strong>{profile.completedMissionIds.length}</strong><span>missions terminées</span></div></div>
    <section className="roadmap-list" aria-label="Mondes d’apprentissage">{roadmap.worlds.map((world, index) => {
      const availableMissionIds = world.missionIds.filter((id) => missions.some((mission) => mission.id === id));
      const completed = availableMissionIds.filter((id) => profile.completedMissionIds.includes(id)).length;
      const available = availableMissionIds.length > 0;
      return <article className={`world-card ${available ? "current" : "locked"}`} key={world.id}><div className={`world-icon ${world.accent}`} aria-hidden="true">{index === 0 ? "✦" : index === 1 ? "⌂" : "↗"}</div><div><small>Monde {index + 1}</small><h2>{world.title}</h2><p>{world.eyebrow}</p><span>{available ? `${completed} / ${availableMissionIds.length} missions` : "Bientôt disponible"}</span>{available && <button type="button" onClick={onContinue}>Continuer ce monde <b aria-hidden="true">→</b></button>}</div></article>;
    })}</section>
    <BottomNav active="progress" onNavigate={onNavigate} />
  </main>;
}

interface PWAStatus {
  canInstall: boolean;
  isInstalled: boolean;
  isOnline: boolean;
  offlineReady: boolean;
}

function SettingsScreen({ profile, pwa, onInstall, onNavigate, onNotify, onResetRequest, onImport, onLevelChange }: { profile: LearningProfile; pwa: PWAStatus; onInstall: () => void; onNavigate: (view: View) => void; onNotify: (message: string) => void; onResetRequest: () => void; onImport: (value: string) => void; onLevelChange: (level: CEFRLevel) => void }) {
  const importRef = useRef<HTMLInputElement>(null);
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
  const installDescription = pwa.isInstalled ? "Bibata est déjà installée" : pwa.canInstall ? "Ajoute Bibata à ton écran d’accueil" : "Disponible depuis le menu de ton navigateur";
  return <main className="app-shell page-enter"><AppHeader completedCount={profile.completedMissionIds.length} /><section className="page-heading"><p className="eyebrow">Ton expérience</p><h1>Réglages</h1><p>Personnalise Bibata et garde le contrôle sur tes données.</p></section>
    <div className="settings-layout">
      <div>
        <section className="settings-group"><h2>Apprentissage</h2><label className="level-setting"><span className="settings-icon">Aa</span><div><strong>Niveau de conversation</strong><small>{levelDescriptions[profile.estimatedLevel ?? "A1"]} · difficulté et modèle adaptés</small></div><select value={profile.estimatedLevel ?? "A1"} onChange={(event) => onLevelChange(event.target.value as CEFRLevel)} aria-label="Niveau de conversation">{CEFR_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></label></section>
        <section className="settings-group"><h2>Application</h2><button className="settings-row" type="button" onClick={onInstall} disabled={!pwa.canInstall || pwa.isInstalled}><span className="settings-icon">↓</span><div><strong>Installer Bibata</strong><small>{installDescription}</small></div><i aria-hidden="true">{pwa.isInstalled ? "✓" : "›"}</i></button><div className="settings-static-row"><span className={`settings-icon ${pwa.isOnline ? "online" : "offline"}`}>●</span><div><strong>{pwa.isOnline ? "Connexion disponible" : "Mode hors ligne"}</strong><small>{pwa.offlineReady ? "L’interface reste accessible hors ligne" : "Une connexion est nécessaire pour discuter avec Bibata"}</small></div><i aria-hidden="true">{pwa.isOnline ? "✓" : "—"}</i></div></section>
      </div>
      <div>
        <section className="settings-group"><h2>Tes données</h2><button className="settings-row" type="button" onClick={() => void exportData()}><span className="settings-icon">⇩</span><div><strong>Exporter mes données</strong><small>Télécharger une sauvegarde JSON</small></div><i aria-hidden="true">›</i></button><button className="settings-row" type="button" onClick={() => importRef.current?.click()}><span className="settings-icon">⇧</span><div><strong>Importer une sauvegarde</strong><small>Restaurer une progression Bibata</small></div><i aria-hidden="true">›</i></button><input ref={importRef} hidden type="file" accept="application/json" onChange={async (event) => { const file = event.target.files?.[0]; if (file) onImport(await file.text()); event.target.value = ""; }} /></section>
        <section className="settings-group"><h2>Zone sensible</h2><button className="settings-row danger-row" type="button" onClick={onResetRequest}><span className="settings-icon">↺</span><div><strong>Réinitialiser la progression</strong><small>Effacer les données enregistrées sur cet appareil</small></div><i aria-hidden="true">›</i></button></section>
      </div>
    </div>
    <p className="version-note">Bibata · Version locale · Données privées sur cet appareil</p><BottomNav active="settings" onNavigate={onNavigate} />
  </main>;
}

function MissionHeader({ progress, onClose }: { progress: number; onClose: () => void }) {
  return <header className="mission-header"><button type="button" className="icon-button" onClick={onClose} aria-label="Quitter la mission">×</button><ProgressLine value={progress} label="Progression de la mission" /><span>{progress}%</span></header>;
}

function ExerciseCard({ exercise, onAnswer }: { exercise: Exercise; onAnswer: (answer: string, correct: boolean) => void }) {
  const [selected, setSelected] = useState("");
  const [checked, setChecked] = useState(false);
  const [tokens, setTokens] = useState<string[]>([]);
  const choices = exercise.payload.choices ?? exercise.payload.tokens ?? [];
  const answer = exercise.type === "sentence_builder" ? tokens.join(" ") : selected;
  const correct = normalizeAnswer(answer) === normalizeAnswer(exercise.payload.answer);
  const select = (choice: string) => {
    if (checked) return;
    if (exercise.type === "sentence_builder") setTokens((current) => current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice]);
    else setSelected(choice);
  };
  return <section className="exercise-body"><p className="eyebrow">À toi de jouer</p><h1>{exercise.prompt}</h1>
    {exercise.type === "sentence_builder" && <div className="sentence-slot" aria-live="polite">{tokens.length ? tokens.join(" ") : <span>Touche les mots dans l’ordre</span>}</div>}
    <div className={exercise.type === "sentence_builder" ? "token-grid" : "choice-list"}>{choices.map((choice, index) => { const active = exercise.type === "sentence_builder" ? tokens.includes(choice) : selected === choice; const revealClass = checked && normalizeAnswer(choice) === normalizeAnswer(exercise.payload.answer) ? "correct" : checked && active && !correct ? "incorrect" : ""; return <button type="button" className={`${active ? "selected" : ""} ${revealClass}`} key={choice} onClick={() => select(choice)} disabled={checked} aria-pressed={active}><span>{exercise.type === "sentence_builder" ? choice : String.fromCharCode(65 + index)}</span>{exercise.type !== "sentence_builder" && <strong>{choice}</strong>}{checked && normalizeAnswer(choice) === normalizeAnswer(exercise.payload.answer) && <i aria-hidden="true">✓</i>}</button>; })}</div>
    {checked && <div className={`answer-feedback ${correct ? "good" : "gentle"}`} role="status"><strong>{correct ? "Très bien !" : "Presque."}</strong><p>{correct ? "Tu peux continuer." : <>La bonne réponse est <b>{exercise.payload.answer}</b>.</>}</p></div>}
    <div className="sticky-action"><button className="primary-button" type="button" disabled={!answer} onClick={() => checked ? onAnswer(answer, correct) : setChecked(true)}>{checked ? "Continuer" : "Vérifier"}<span>→</span></button></div>
  </section>;
}

function getConversationErrorMessage(error: unknown, isOnline: boolean) {
  if (!isOnline) return "Tu es hors ligne. Reconnecte-toi pour recevoir la réponse de Bibata, puis réessaie.";
  if (!(error instanceof AIProviderError)) return "La conversation est momentanément indisponible. Vérifie ta connexion, puis réessaie.";
  switch (error.code) {
    case "MAMMOUTH_NOT_CONFIGURED":
    case "MAMMOUTH_AUTH_FAILED": return "Le service de conversation n’est pas correctement configuré.";
    case "MAMMOUTH_RATE_LIMITED": return "Le service reçoit trop de demandes. Patiente un instant, puis réessaie.";
    case "MAMMOUTH_TIMEOUT": return "La réponse prend trop de temps. Réessaie dans un instant.";
    case "MAMMOUTH_INVALID_RESPONSE":
    case "INVALID_API_RESPONSE": return "Le service a renvoyé une réponse inutilisable. Tu peux réessayer.";
    default: return "La conversation est momentanément indisponible. Vérifie ta connexion, puis réessaie.";
  }
}

function ConversationStage({ mission, level, isOnline, onComplete }: { mission: Mission; level: CEFRLevel; isOnline: boolean; onComplete: () => void }) {
  const opening = mission.conversation.id === "intro-party" ? `Hi! I'm ${mission.conversation.characterName}. What's your name?` : "Hey! What does a normal day look like for you?";
  const [messages, setMessages] = useState<ConversationMessage[]>([{ id: "opening", role: "character", text: opening }]);
  const [draft, setDraft] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [aiError, setAiError] = useState("");
  const messageId = useRef(0);
  const requestInFlight = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const completedTurns = countCompletedConversationTurns(messages);

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
    await requestReply(next);
  };

  return <section className="conversation-stage"><div className="scenario-card"><span className="avatar">{mission.conversation.characterName.charAt(0)}</span><div><small>Situation réelle · Niveau {level}</small><h1>{mission.conversation.title}</h1><p>{mission.conversation.setting}</p></div></div><div className="objective-pills">{mission.conversation.objectives.map((item, index) => <span key={item} className={index < completedTurns ? "done" : ""}>{index < completedTurns ? "✓" : index + 1} {item}</span>)}</div>
    <div className="chat-window" aria-live="polite">{messages.map((message) => <div className={`message ${message.role}`} key={message.id}>{message.role === "character" && <small>{mission.conversation.characterName}</small>}<p>{message.text}</p></div>)}{waiting && <div className="typing" role="status"><i /><i /><i /><span>{mission.conversation.characterName} prépare sa réponse…</span></div>}<div ref={chatEndRef} /></div>
    {aiError ? <div className="conversation-error" role="alert"><div><strong>Impossible de poursuivre la conversation</strong><p>{aiError}</p></div><button type="button" onClick={() => void requestReply(messages)} disabled={waiting || !isOnline}>Réessayer</button></div> : completedTurns >= 3 ? <div className="sticky-action"><button className="primary-button" type="button" onClick={onComplete}>Voir mon bilan <span>→</span></button></div> : !waiting ? <><div className="reply-suggestions" aria-label="Réponses suggérées">{mission.conversation.suggestedReplies.slice(completedTurns, completedTurns + 2).map((reply) => <button type="button" key={reply} onClick={() => void send(reply)}>{reply}</button>)}</div><form className="chat-input" onSubmit={(event) => { event.preventDefault(); void send(draft); }}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Écris ta réponse…" aria-label="Ta réponse" autoComplete="off" /><button type="submit" disabled={!draft.trim()} aria-label="Envoyer">↑</button></form></> : null}
  </section>;
}

function MissionFlow({ mission, level, isOnline, onExit, onFinish }: { mission: Mission; level: CEFRLevel; isOnline: boolean; onExit: () => void; onFinish: (attempts: ExerciseAttempt[], score: MissionScore) => void }) {
  const [stage, setStage] = useState<MissionStage>("intro");
  const [conceptIndex, setConceptIndex] = useState(0);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [attempts, setAttempts] = useState<ExerciseAttempt[]>([]);
  const [score, setScore] = useState<MissionScore>({ total: 0, concepts: 0, comprehension: 0, usage: 0 });
  const [exitConfirm, setExitConfirm] = useState(false);
  const missionConcepts = mission.conceptIds.map((id) => getConcept(id)).filter((item) => item !== undefined);
  const concept = missionConcepts[conceptIndex];
  const progressMap: Record<MissionStage, number> = { intro: 4, discover: 20 + conceptIndex * 6, context: 48, exercise: 55 + exerciseIndex * 10, conversation: 88, result: 100 };
  const requestExit = () => { if (stage === "intro") onExit(); else setExitConfirm(true); };
  const advanceConcept = () => { if (conceptIndex < missionConcepts.length - 1) setConceptIndex((index) => index + 1); else { setConceptIndex(0); setStage("context"); } };
  const recordAnswer = (answer: string, correct: boolean) => {
    const exercise = mission.exercises[exerciseIndex];
    const modes: ExerciseAttempt["mode"][] = ["recognition", "context", "production"];
    const nextAttempt: ExerciseAttempt = { exerciseId: exercise.id, conceptIds: exercise.concepts, correct, response: answer, mode: modes[exerciseIndex] ?? "recall", answeredAt: Date.now() };
    const next = [...attempts, nextAttempt];
    setAttempts(next);
    if (exerciseIndex < mission.exercises.length - 1) setExerciseIndex((index) => index + 1);
    else setStage("conversation");
  };
  const completeConversation = () => {
    const conversationAttempt: ExerciseAttempt = { exerciseId: `${mission.id}-conversation`, conceptIds: mission.conversation.targetConcepts, correct: true, response: "conversation completed", mode: "production", answeredAt: Date.now() };
    const completeAttempts = [...attempts, conversationAttempt];
    setAttempts(completeAttempts);
    setScore(calculateMissionScore(completeAttempts));
    setStage("result");
  };

  let screen: ReactNode;
  if (stage === "intro") screen = <main className="mission-shell intro-screen page-enter"><MissionHeader progress={progressMap[stage]} onClose={requestExit} /><section className="mission-intro"><div className="world-orbit"><span>✦</span><i /><i /></div><p className="eyebrow">Mission {mission.order} · {mission.eyebrow}</p><h1>{mission.title}</h1><p>{mission.description}</p><div className="mission-meta"><span>◷ {mission.durationMinutes} min</span><span>＋ {mission.conceptIds.length} concepts</span><span>Niveau {level}</span></div></section><div className="sticky-action"><button className="primary-button" type="button" onClick={() => setStage("discover")}>Commencer <span>→</span></button></div></main>;
  else if (stage === "discover" && concept) screen = <main className="mission-shell page-enter"><MissionHeader progress={progressMap[stage]} onClose={requestExit} /><section className="concept-stage"><p className="eyebrow">Nouveau concept · {conceptIndex + 1} sur {missionConcepts.length}</p><div className="concept-visual"><span>{concept.type === "word" ? "Aa" : "…"}</span></div><h1>{concept.value}</h1><p className="translation">{concept.translation}</p><span className="type-pill">{concept.type === "word" ? "Mot" : concept.type === "expression" ? "Expression" : "Construction"}</span></section><div className="sticky-action"><button className="primary-button" type="button" onClick={advanceConcept}>J’ai compris <span>→</span></button></div></main>;
  else if (stage === "context" && concept) screen = <main className="mission-shell page-enter"><MissionHeader progress={progressMap[stage]} onClose={requestExit} /><section className="context-stage"><p className="eyebrow">En contexte</p><div className="quote-mark">“</div><blockquote>{concept.examples[0].text}</blockquote><p>{concept.examples[0].translation}</p><div className="context-note"><span>✦</span><div><strong>À retenir</strong><p>Écoute le rythme de la phrase, pas seulement chaque mot.</p></div></div></section><div className="sticky-action"><button className="primary-button" type="button" onClick={() => setStage("exercise")}>À moi de jouer <span>→</span></button></div></main>;
  else if (stage === "exercise") screen = <main className="mission-shell"><MissionHeader progress={progressMap[stage]} onClose={requestExit} /><ExerciseCard key={mission.exercises[exerciseIndex].id} exercise={mission.exercises[exerciseIndex]} onAnswer={recordAnswer} /></main>;
  else if (stage === "conversation") screen = <main className="mission-shell"><MissionHeader progress={progressMap[stage]} onClose={requestExit} /><ConversationStage mission={mission} level={level} isOnline={isOnline} onComplete={completeConversation} /></main>;
  else screen = <main className="mission-shell result-screen page-enter"><section className="result-hero"><div className="celebration-mark">✓<i /><i /><i /></div><p className="eyebrow">Mission {mission.order} terminée</p><h1>Beau travail !</h1><p>Tu as reconnu, compris et utilisé tes nouveaux mots dans une vraie situation.</p></section><div className="score-card"><div className="score-total"><span><strong>{score.total}</strong>/100</span><p>Score global</p></div>{(["concepts", "comprehension", "usage"] as const).map((item) => <div className="score-row" key={item}><span>{item === "concepts" ? "Concepts" : item === "comprehension" ? "Compréhension" : "Utilisation"}</span><ProgressLine value={score[item]} label={`Score ${item}`} /><strong>{score[item]}%</strong></div>)}</div><div className="learned-banner"><span>＋{mission.conceptIds.length}</span><div><strong>concepts rencontrés</strong><p>Ils reviendront naturellement dans les prochaines missions.</p></div></div><div className="sticky-action"><button className="primary-button" type="button" onClick={() => onFinish(attempts, score)}>Revenir à l’accueil <span>→</span></button></div></main>;

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
  const noticeTimer = useRef<number | undefined>(undefined);
  const pwa = usePWA();
  const profile = state.profiles.find((item) => item.language === (state.activeLanguage ?? "en"));
  const learnedCount = useMemo(() => Object.values(state.mastery).filter((item) => item.exposureCount > 0).length, [state.mastery]);

  const notify = (message: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 3_000);
  };

  useEffect(() => {
    storageRepository.getState().then((saved) => {
      setState(saved);
      setView(saved.profiles.length ? "home" : "onboarding-language");
      setLoading(false);
    });
    return () => window.clearTimeout(noticeTimer.current);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [view]);

  const chooseLanguage = (code: string) => { setSelectedLanguage(code); setView("onboarding-level"); };
  const finishOnboarding = async (interests: string[]) => {
    const language = languages.find((item) => item.code === selectedLanguage) ?? languages[0];
    const now = Date.now();
    const newProfile: LearningProfile = { id: `local-${selectedLanguage}`, language: selectedLanguage, languageName: language.name, languageFlag: language.flag, estimatedLevel: selectedLevel, levelConfidence: 1, interests, ability: initialAbility, currentMissionId: missions[0].id, completedMissionIds: [], createdAt: now, updatedAt: now };
    const nextState = { ...state, profiles: [...state.profiles.filter((item) => item.language !== selectedLanguage), newProfile], activeLanguage: selectedLanguage };
    setState(nextState);
    await storageRepository.saveState(nextState);
    setActiveMission(missions[0]);
    setView("mission");
  };
  const startMission = () => { if (!profile) return; setActiveMission(getNextMission(profile, missions) ?? missions[0]); setView("mission"); };
  const changeLevel = async (level: CEFRLevel) => {
    if (!profile) return;
    const nextProfile = { ...profile, estimatedLevel: level, levelConfidence: 1, updatedAt: Date.now() };
    const nextState = { ...state, profiles: state.profiles.map((item) => item.id === profile.id ? nextProfile : item) };
    setState(nextState);
    await storageRepository.saveState(nextState);
    notify(`Niveau ${level} appliqué`);
  };
  const finishMission = async (attempts: ExerciseAttempt[], score: MissionScore) => {
    if (!profile) return;
    const nextMastery = { ...state.mastery };
    for (const attempt of attempts) for (const conceptId of attempt.conceptIds) nextMastery[conceptId] = updateConceptMastery(nextMastery[conceptId], { ...attempt, conceptIds: [conceptId] });
    for (const conceptId of activeMission.conceptIds) if (!nextMastery[conceptId]) nextMastery[conceptId] = { ...createEmptyMastery(conceptId), exposureCount: 1, recognition: 0.08, masteryScore: 0.02, confidence: 0.15, lastSeenAt: Date.now() };
    const completedMissionIds = [...new Set([...profile.completedMissionIds, activeMission.id])];
    const nextProfile: LearningProfile = { ...profile, completedMissionIds, currentMissionId: missions.find((mission) => !completedMissionIds.includes(mission.id))?.id ?? missions.at(-1)?.id, updatedAt: Date.now() };
    const nextState: PersistedState = { ...state, mastery: nextMastery, profiles: state.profiles.map((item) => item.id === profile.id ? nextProfile : item), missionProgress: { ...state.missionProgress, [activeMission.id]: { missionId: activeMission.id, status: "completed", score: score.total, completedAt: Date.now() } } };
    setState(nextState);
    await storageRepository.saveState(nextState);
    setView("home");
    notify("Mission enregistrée");
  };
  const reset = async () => {
    await storageRepository.reset();
    setState(structuredClone(emptyState));
    setSelectedLanguage("en");
    setSelectedLevel("A1");
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
  const installApp = async () => { if (await pwa.install()) notify("Bibata a été ajoutée à ton appareil"); };

  let content: ReactNode;
  if (loading) content = <main className="loading-screen"><Logo /><span className="loading-dot" /><p>Préparation de ton parcours…</p></main>;
  else if (view === "onboarding-language") content = <OnboardingLanguage onChoose={chooseLanguage} />;
  else if (view === "onboarding-level") content = <OnboardingLevel selected={selectedLevel} onBack={() => setView("onboarding-language")} onSelect={setSelectedLevel} onContinue={() => setView("onboarding-interests")} />;
  else if (view === "onboarding-interests") content = <OnboardingInterests onBack={() => setView("onboarding-level")} onContinue={(interests) => void finishOnboarding(interests)} />;
  else if (view === "mission") content = <MissionFlow key={`${activeMission.id}-${profile?.estimatedLevel ?? selectedLevel}`} mission={activeMission} level={profile?.estimatedLevel ?? selectedLevel} isOnline={pwa.isOnline} onExit={() => setView(profile ? "home" : "onboarding-interests")} onFinish={(attempts, score) => void finishMission(attempts, score)} />;
  else if (!profile) content = <OnboardingLanguage onChoose={chooseLanguage} />;
  else if (view === "progress") content = <ProgressScreen profile={profile} masteryCount={learnedCount} onContinue={startMission} onNavigate={setView} />;
  else if (view === "settings") content = <SettingsScreen key={`${pwa.isOnline}-${pwa.offlineReady}-${pwa.canInstall}-${pwa.isInstalled}`} profile={profile} pwa={pwa} onInstall={() => void installApp()} onNavigate={setView} onNotify={notify} onResetRequest={() => setResetConfirm(true)} onImport={(value) => void importData(value)} onLevelChange={(level) => void changeLevel(level)} />;
  else content = <HomeScreen profile={profile} learnedCount={learnedCount} canInstall={pwa.canInstall} offlineReady={pwa.offlineReady} onContinue={startMission} onInstall={() => void installApp()} onNavigate={setView} />;

  return <>{!pwa.isOnline && <div className="network-banner" role="status"><span aria-hidden="true">○</span>Mode hors ligne · les conversations IA nécessitent une connexion</div>}{content}{notice && <Toast message={notice} />}{resetConfirm && <ConfirmDialog title="Tout recommencer ?" description="Tous les profils, missions et résultats enregistrés sur cet appareil seront effacés." confirmLabel="Tout effacer" onCancel={() => setResetConfirm(false)} onConfirm={() => void reset()} />}</>;
}
