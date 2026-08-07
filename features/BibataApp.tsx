"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { aiProvider } from "@/ai/provider";
import { getConcept, interestOptions, languages, missions, roadmap } from "@/data/curriculum";
import { calculateMissionScore, createEmptyMastery, estimateLevel, getNextMission, updateConceptMastery } from "@/core/learning-engine";
import { emptyState, storageRepository } from "@/storage/repository";
import type { ConversationMessage, Exercise, ExerciseAttempt, LearningProfile, Mission, MissionScore, PersistedState } from "@/types/learning";

type View = "onboarding-language" | "onboarding-interests" | "home" | "progress" | "settings" | "mission";
type MissionStage = "intro" | "discover" | "context" | "exercise" | "conversation" | "result";

const initialAbility = { vocabulary: 0.12, grammar: 0.1, comprehension: 0.14, recall: 0.08, production: 0.06 };
const normalizeAnswer = (value: string) => value.toLowerCase().replace(/[.!?,’']/g, "").replace(/\s+/g, " ").trim();

const Logo = () => <span className="brand" aria-label="Bibata"><span className="brand-mark" aria-hidden="true">b</span><span>Bibata</span></span>;

function ProgressLine({ value }: { value: number }) {
  return <span className="progress-line" aria-label={`${value}%`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>;
}

function OnboardingLanguage({ onChoose }: { onChoose: (code: string) => void }) {
  return <main className="onboarding-shell page-enter">
    <header className="onboarding-header"><Logo /><span className="step-count">1 sur 2</span></header>
    <section className="onboarding-copy"><p className="eyebrow">Commençons simplement</p><h1>Que veux-tu<br />apprendre ?</h1><p>Choisis une langue. Tu pourras en ajouter d’autres plus tard.</p></section>
    <div className="language-list" role="list">
      {languages.map((language, index) => <button type="button" className={`language-option ${index === 0 ? "active" : ""}`} key={language.code} onClick={() => onChoose(language.code)} disabled={language.availability === "preview"}>
        <span className="flag-disc">{language.flag}</span><span className="language-label"><strong>{language.name}</strong><small>{index === 0 ? "Disponible maintenant" : "Bientôt"}</small></span><span className="option-arrow" aria-hidden="true">{index === 0 ? "→" : ""}</span>
      </button>)}
    </div>
    <p className="onboarding-note">Ton apprentissage reste sur cet appareil.</p>
  </main>;
}

function OnboardingInterests({ onBack, onContinue }: { onBack: () => void; onContinue: (interests: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(["travel", "music"]);
  const [custom, setCustom] = useState("");
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const submitCustom = () => { const value = custom.trim(); if (value && !selected.includes(value)) setSelected((current) => [...current, value]); setCustom(""); };
  return <main className="onboarding-shell page-enter">
    <header className="onboarding-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Retour">←</button><span className="step-count">2 sur 2</span></header>
    <section className="onboarding-copy compact"><p className="eyebrow">Une touche personnelle</p><h1>Qu’est-ce qui<br />t’intéresse ?</h1><p>On s’en servira pour rendre les exemples plus vivants.</p></section>
    <div className="interest-grid">
      {interestOptions.map((interest) => { const active = selected.includes(interest.id); return <button type="button" key={interest.id} className={`interest-chip ${active ? "selected" : ""}`} onClick={() => toggle(interest.id)} aria-pressed={active}><span aria-hidden="true">{interest.icon}</span>{interest.label}<i>{active ? "✓" : "+"}</i></button>; })}
    </div>
    <form className="custom-interest" onSubmit={(event) => { event.preventDefault(); submitCustom(); }}><input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Ajouter un intérêt…" aria-label="Ajouter un intérêt" /><button type="submit" disabled={!custom.trim()} aria-label="Ajouter">+</button></form>
    {selected.filter((item) => !interestOptions.some((option) => option.id === item)).map((item) => <button type="button" className="custom-tag" key={item} onClick={() => toggle(item)}>{item} ×</button>)}
    <div className="sticky-action"><button className="primary-button" type="button" onClick={() => onContinue(selected)} disabled={selected.length === 0}>Commencer à jouer <span>→</span></button></div>
  </main>;
}

function BottomNav({ active, onNavigate }: { active: View; onNavigate: (view: View) => void }) {
  return <nav className="bottom-nav" aria-label="Navigation principale"><button className={active === "home" ? "active" : ""} onClick={() => onNavigate("home")} type="button"><span>⌂</span>Accueil</button><button className={active === "progress" ? "active" : ""} onClick={() => onNavigate("progress")} type="button"><span>↗</span>Parcours</button><button className={active === "settings" ? "active" : ""} onClick={() => onNavigate("settings")} type="button"><span>◌</span>Réglages</button></nav>;
}

function AppHeader({ streak }: { streak: number }) {
  return <header className="app-header"><Logo /><span className="streak" aria-label={`${streak} jours de suite`}><span aria-hidden="true">◆</span>{streak}</span></header>;
}

function HomeScreen({ profile, learnedCount, onContinue, onNavigate, onAddLanguage }: { profile: LearningProfile; learnedCount: number; onContinue: () => void; onNavigate: (view: View) => void; onAddLanguage: () => void }) {
  const nextMission = getNextMission(profile, missions) ?? missions[0];
  const completed = profile.completedMissionIds.length;
  return <main className="app-shell page-enter"><AppHeader streak={completed ? 4 : 1} />
    <section className="greeting"><p>Bonjour 👋</p><h1>{completed ? "On garde le rythme ?" : "Prêt·e pour tes premiers mots ?"}</h1></section>
    <section className="hero-card"><div className="hero-card-top"><span className="language-pill">{profile.languageFlag} {profile.languageName}</span><button type="button" className="more-button" aria-label="Plus d’options">•••</button></div>
      <div className="level-row"><div><small>Niveau estimé</small><strong>{profile.levelConfidence < 0.2 ? "En cours…" : profile.estimatedLevel}</strong></div><div><small>Concepts</small><strong>{learnedCount}</strong></div></div>
      <div className="mission-preview"><span className="mission-number">{String(nextMission.order).padStart(2, "0")}</span><div><small>{nextMission.eyebrow}</small><h2>{nextMission.title}</h2><p>≈ {nextMission.durationMinutes} min · {nextMission.conceptIds.length} concepts</p></div></div>
      <button className="primary-button light" type="button" onClick={onContinue}>Continuer <span>→</span></button></section>
    <section className="today-strip"><div className="mini-ring"><strong>{completed ? 2 : 0}</strong><small>/3</small></div><div><strong>Ton élan du jour</strong><p>{completed ? "Une petite mission et c’est gagné." : "Commence par une mission de 5 minutes."}</p></div></section>
    <button className="add-language" type="button" onClick={onAddLanguage}><span>＋</span><div><strong>Apprendre une autre langue</strong><small>Un parcours indépendant, quand tu veux</small></div><i>›</i></button>
    <BottomNav active="home" onNavigate={onNavigate} />
  </main>;
}

function ProgressScreen({ profile, masteryCount, onNavigate }: { profile: LearningProfile; masteryCount: number; onNavigate: (view: View) => void }) {
  return <main className="app-shell page-enter"><AppHeader streak={profile.completedMissionIds.length ? 4 : 1} />
    <section className="page-heading"><p className="eyebrow">Ton chemin</p><h1>{profile.languageFlag} {profile.languageName}</h1><p>Chaque mission t’emmène un peu plus loin.</p></section>
    <section className="level-card"><div className="level-badge">{profile.estimatedLevel ?? "A1"}</div><div><small>Niveau estimé</small><strong>Vers A2</strong><ProgressLine value={Math.round(profile.levelConfidence * 100)} /></div></section>
    <div className="stat-pair"><div><strong>{masteryCount}</strong><span>concepts rencontrés</span></div><div><strong>{profile.completedMissionIds.length}</strong><span>missions terminées</span></div></div>
    <section className="roadmap-list">{roadmap.worlds.map((world, index) => <article className={`world-card ${index === 0 ? "current" : "locked"}`} key={world.id}><div className={`world-icon ${world.accent}`}>{index === 0 ? "✦" : index === 1 ? "⌂" : "↗"}</div><div><small>Monde {index + 1}</small><h2>{world.title}</h2><p>{world.eyebrow}</p><span>{index === 0 ? `${profile.completedMissionIds.length} / 2 missions` : "À venir"}</span></div></article>)}</section>
    <BottomNav active="progress" onNavigate={onNavigate} />
  </main>;
}

function SettingsScreen({ onNavigate, onReset, onImport }: { onNavigate: (view: View) => void; onReset: () => void; onImport: (value: string) => void }) {
  const importRef = useRef<HTMLInputElement>(null);
  const exportData = async () => { const value = await storageRepository.exportJSON(); const blob = new Blob([value], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "bibata-progress.json"; link.click(); URL.revokeObjectURL(link.href); };
  return <main className="app-shell page-enter"><AppHeader streak={1} /><section className="page-heading"><p className="eyebrow">Sur cet appareil</p><h1>Réglages</h1><p>Gère tes données locales et ton expérience.</p></section>
    <section className="settings-group"><h2>Données d’apprentissage</h2><button type="button" onClick={exportData}><span className="settings-icon">⇩</span><div><strong>Exporter mes données</strong><small>Télécharger une sauvegarde JSON</small></div><i>›</i></button><button type="button" onClick={() => importRef.current?.click()}><span className="settings-icon">⇧</span><div><strong>Importer une sauvegarde</strong><small>Restaurer une progression Bibata</small></div><i>›</i></button><input ref={importRef} hidden type="file" accept="application/json" onChange={async (event) => { const file = event.target.files?.[0]; if (file) onImport(await file.text()); }} /></section>
    <section className="settings-group"><h2>Développement</h2><button className="danger-row" type="button" onClick={onReset}><span className="settings-icon">↺</span><div><strong>Réinitialiser la progression</strong><small>Revenir au tout premier lancement</small></div><i>›</i></button></section><p className="version-note">Bibata · Prototype V1 · Données stockées localement</p><BottomNav active="settings" onNavigate={onNavigate} />
  </main>;
}

function MissionHeader({ progress, onClose }: { progress: number; onClose: () => void }) {
  return <header className="mission-header"><button type="button" className="icon-button" onClick={onClose} aria-label="Quitter la mission">×</button><ProgressLine value={progress} /><span>{progress}%</span></header>;
}

function ExerciseCard({ exercise, onAnswer }: { exercise: Exercise; onAnswer: (answer: string, correct: boolean) => void }) {
  const [selected, setSelected] = useState(""); const [checked, setChecked] = useState(false); const [tokens, setTokens] = useState<string[]>([]);
  const choices = exercise.payload.choices ?? exercise.payload.tokens ?? []; const answer = exercise.type === "sentence_builder" ? tokens.join(" ") : selected; const correct = normalizeAnswer(answer) === normalizeAnswer(exercise.payload.answer);
  const select = (choice: string) => { if (checked) return; if (exercise.type === "sentence_builder") setTokens((current) => current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice]); else setSelected(choice); };
  return <section className="exercise-body"><p className="eyebrow">À toi de jouer</p><h1>{exercise.prompt}</h1>
    {exercise.type === "sentence_builder" && <div className="sentence-slot">{tokens.length ? tokens.join(" ") : <span>Touche les mots dans l’ordre</span>}</div>}
    <div className={exercise.type === "sentence_builder" ? "token-grid" : "choice-list"}>{choices.map((choice, index) => { const active = exercise.type === "sentence_builder" ? tokens.includes(choice) : selected === choice; const revealClass = checked && normalizeAnswer(choice) === normalizeAnswer(exercise.payload.answer) ? "correct" : checked && active && !correct ? "incorrect" : ""; return <button type="button" className={`${active ? "selected" : ""} ${revealClass}`} key={choice} onClick={() => select(choice)} disabled={checked}><span>{exercise.type === "sentence_builder" ? choice : String.fromCharCode(65 + index)}</span>{exercise.type !== "sentence_builder" && <strong>{choice}</strong>}{checked && normalizeAnswer(choice) === normalizeAnswer(exercise.payload.answer) && <i>✓</i>}</button>; })}</div>
    {checked && <div className={`answer-feedback ${correct ? "good" : "gentle"}`} role="status"><strong>{correct ? "Très bien !" : "Presque."}</strong><p>{correct ? "Tu peux continuer." : <>La bonne réponse est <b>{exercise.payload.answer}</b>.</>}</p></div>}
    <div className="sticky-action"><button className="primary-button" type="button" disabled={!answer} onClick={() => checked ? onAnswer(answer, correct) : setChecked(true)}>{checked ? "Continuer" : "Vérifier"}<span>→</span></button></div>
  </section>;
}

function ConversationStage({ mission, onComplete }: { mission: Mission; onComplete: () => void }) {
  const opening = mission.conversation.id === "intro-party" ? "Hi! I'm Maya. What's your name?" : "Hey! What does a normal day look like for you?";
  const [messages, setMessages] = useState<ConversationMessage[]>([{ id: "opening", role: "character", text: opening }]); const [draft, setDraft] = useState(""); const [waiting, setWaiting] = useState(false); const messageId = useRef(0); const learnerTurns = messages.filter((message) => message.role === "learner").length;
  const send = async (value: string) => { const text = value.trim(); if (!text || waiting) return; messageId.current += 1; const learnerMessage: ConversationMessage = { id: `learner-${messageId.current}`, role: "learner", text }; const next = [...messages, learnerMessage]; setMessages(next); setDraft(""); if (learnerTurns + 1 >= 3) return; setWaiting(true); const response = await aiProvider.generateConversationTurn(mission.conversation, next); setMessages((current) => [...current, response]); setWaiting(false); };
  return <section className="conversation-stage"><div className="scenario-card"><span className="avatar">M</span><div><small>Situation réelle</small><h1>{mission.conversation.title}</h1><p>{mission.conversation.setting}</p></div></div><div className="objective-pills">{mission.conversation.objectives.map((item, index) => <span key={item} className={index < learnerTurns ? "done" : ""}>{index < learnerTurns ? "✓" : index + 1} {item}</span>)}</div>
    <div className="chat-window" aria-live="polite">{messages.map((message) => <div className={`message ${message.role}`} key={message.id}>{message.role === "character" && <small>{mission.conversation.characterName}</small>}<p>{message.text}</p></div>)}{waiting && <div className="typing" aria-label="Maya écrit"><i /><i /><i /></div>}</div>
    {learnerTurns < 3 ? <><div className="reply-suggestions">{mission.conversation.suggestedReplies.slice(learnerTurns, learnerTurns + 2).map((reply) => <button type="button" key={reply} onClick={() => send(reply)}>{reply}</button>)}</div><form className="chat-input" onSubmit={(event) => { event.preventDefault(); void send(draft); }}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Écris ta réponse…" aria-label="Ta réponse" /><button type="submit" disabled={!draft.trim()} aria-label="Envoyer">↑</button></form></> : <div className="sticky-action"><button className="primary-button" type="button" onClick={onComplete}>Voir mon bilan <span>→</span></button></div>}
  </section>;
}

function MissionFlow({ mission, onExit, onFinish }: { mission: Mission; onExit: () => void; onFinish: (attempts: ExerciseAttempt[], score: MissionScore) => void }) {
  const [stage, setStage] = useState<MissionStage>("intro"); const [conceptIndex, setConceptIndex] = useState(0); const [exerciseIndex, setExerciseIndex] = useState(0); const [attempts, setAttempts] = useState<ExerciseAttempt[]>([]); const [score, setScore] = useState<MissionScore>({ total: 0, concepts: 0, comprehension: 0, usage: 0 });
  const missionConcepts = mission.conceptIds.map((id) => getConcept(id)).filter((item) => item !== undefined); const concept = missionConcepts[conceptIndex]; const progressMap: Record<MissionStage, number> = { intro: 4, discover: 20 + conceptIndex * 6, context: 48, exercise: 55 + exerciseIndex * 10, conversation: 88, result: 100 };
  const advanceConcept = () => { if (conceptIndex < missionConcepts.length - 1) setConceptIndex((index) => index + 1); else { setConceptIndex(0); setStage("context"); } };
  const recordAnswer = (answer: string, correct: boolean) => { const exercise = mission.exercises[exerciseIndex]; const modes: ExerciseAttempt["mode"][] = ["recognition", "context", "production"]; const nextAttempt: ExerciseAttempt = { exerciseId: exercise.id, conceptIds: exercise.concepts, correct, response: answer, mode: modes[exerciseIndex] ?? "recall", answeredAt: Date.now() }; const next = [...attempts, nextAttempt]; setAttempts(next); if (exerciseIndex < mission.exercises.length - 1) setExerciseIndex((index) => index + 1); else setStage("conversation"); };
  const completeConversation = () => { const conversationAttempt: ExerciseAttempt = { exerciseId: `${mission.id}-conversation`, conceptIds: mission.conversation.targetConcepts, correct: true, response: "conversation completed", mode: "production", answeredAt: Date.now() }; const completeAttempts = [...attempts, conversationAttempt]; setAttempts(completeAttempts); setScore(calculateMissionScore(completeAttempts)); setStage("result"); };
  if (stage === "intro") return <main className="mission-shell intro-screen page-enter"><MissionHeader progress={progressMap[stage]} onClose={onExit} /><section className="mission-intro"><div className="world-orbit"><span>✦</span><i /><i /></div><p className="eyebrow">Mission {mission.order} · {mission.eyebrow}</p><h1>{mission.title}</h1><p>{mission.description}</p><div className="mission-meta"><span>◷ {mission.durationMinutes} min</span><span>＋ {mission.conceptIds.length} concepts</span></div></section><div className="sticky-action"><button className="primary-button" type="button" onClick={() => setStage("discover")}>Commencer <span>→</span></button></div></main>;
  if (stage === "discover" && concept) return <main className="mission-shell page-enter"><MissionHeader progress={progressMap[stage]} onClose={onExit} /><section className="concept-stage"><p className="eyebrow">Nouveau concept · {conceptIndex + 1} sur {missionConcepts.length}</p><div className="concept-visual"><span>{concept.type === "word" ? "Aa" : "…"}</span></div><h1>{concept.value}</h1><p className="translation">{concept.translation}</p><span className="type-pill">{concept.type === "word" ? "Mot" : concept.type === "expression" ? "Expression" : "Construction"}</span></section><div className="sticky-action"><button className="primary-button" type="button" onClick={advanceConcept}>J’ai compris <span>→</span></button></div></main>;
  if (stage === "context" && concept) return <main className="mission-shell page-enter"><MissionHeader progress={progressMap[stage]} onClose={onExit} /><section className="context-stage"><p className="eyebrow">En contexte</p><div className="quote-mark">“</div><blockquote>{concept.examples[0].text}</blockquote><p>{concept.examples[0].translation}</p><div className="context-note"><span>✦</span><div><strong>À retenir</strong><p>Écoute le rythme de la phrase, pas seulement chaque mot.</p></div></div></section><div className="sticky-action"><button className="primary-button" type="button" onClick={() => setStage("exercise")}>À moi de jouer <span>→</span></button></div></main>;
  if (stage === "exercise") return <main className="mission-shell"><MissionHeader progress={progressMap[stage]} onClose={onExit} /><ExerciseCard key={mission.exercises[exerciseIndex].id} exercise={mission.exercises[exerciseIndex]} onAnswer={recordAnswer} /></main>;
  if (stage === "conversation") return <main className="mission-shell"><MissionHeader progress={progressMap[stage]} onClose={onExit} /><ConversationStage mission={mission} onComplete={completeConversation} /></main>;
  return <main className="mission-shell result-screen page-enter"><section className="result-hero"><div className="celebration-mark">✓<i /><i /><i /></div><p className="eyebrow">Mission terminée</p><h1>Très beau<br />départ !</h1><p>Tu as utilisé tes nouveaux mots dans une vraie situation.</p></section><div className="score-card"><div className="score-total"><span><strong>{score.total}</strong>/100</span><p>Score global</p></div>{(["concepts", "comprehension", "usage"] as const).map((item) => <div className="score-row" key={item}><span>{item === "concepts" ? "Concepts" : item === "comprehension" ? "Compréhension" : "Utilisation"}</span><ProgressLine value={score[item]} /><strong>{score[item]}%</strong></div>)}</div><div className="learned-banner"><span>＋{mission.conceptIds.length}</span><div><strong>concepts rencontrés</strong><p>Ils reviendront naturellement plus tard.</p></div></div><div className="sticky-action"><button className="primary-button" type="button" onClick={() => onFinish(attempts, score)}>Revenir à l’accueil <span>→</span></button></div></main>;
}

export default function BibataApp() {
  const [state, setState] = useState<PersistedState>(emptyState); const [loading, setLoading] = useState(true); const [view, setView] = useState<View>("onboarding-language"); const [selectedLanguage, setSelectedLanguage] = useState("en"); const [activeMission, setActiveMission] = useState<Mission>(missions[0]);
  const profile = state.profiles.find((item) => item.language === (state.activeLanguage ?? "en"));
  useEffect(() => { storageRepository.getState().then((saved) => { setState(saved); setView(saved.profiles.length ? "home" : "onboarding-language"); setLoading(false); }); }, []);
  const learnedCount = useMemo(() => Object.values(state.mastery).filter((item) => item.exposureCount > 0).length, [state.mastery]);
  const chooseLanguage = (code: string) => { setSelectedLanguage(code); setView("onboarding-interests"); };
  const finishOnboarding = async (interests: string[]) => { const language = languages.find((item) => item.code === selectedLanguage) ?? languages[0]; const now = Date.now(); const newProfile: LearningProfile = { id: `local-${selectedLanguage}`, language: selectedLanguage, languageName: language.name, languageFlag: language.flag, estimatedLevel: "A1", levelConfidence: 0.08, interests, ability: initialAbility, currentMissionId: missions[0].id, completedMissionIds: [], createdAt: now, updatedAt: now }; const nextState = { ...state, profiles: [...state.profiles.filter((item) => item.language !== selectedLanguage), newProfile], activeLanguage: selectedLanguage }; setState(nextState); await storageRepository.saveState(nextState); setActiveMission(missions[0]); setView("mission"); };
  const startMission = () => { if (!profile) return; setActiveMission(getNextMission(profile, missions) ?? missions[0]); setView("mission"); };
  const finishMission = async (attempts: ExerciseAttempt[], score: MissionScore) => { if (!profile) return; const nextMastery = { ...state.mastery }; for (const attempt of attempts) for (const conceptId of attempt.conceptIds) nextMastery[conceptId] = updateConceptMastery(nextMastery[conceptId], { ...attempt, conceptIds: [conceptId] }); for (const conceptId of activeMission.conceptIds) if (!nextMastery[conceptId]) nextMastery[conceptId] = { ...createEmptyMastery(conceptId), exposureCount: 1, recognition: 0.08, masteryScore: 0.02, confidence: 0.15, lastSeenAt: Date.now() }; const completedMissionIds = [...new Set([...profile.completedMissionIds, activeMission.id])]; const recentScores = [...Object.values(state.missionProgress).map((item) => item.score ?? 0), score.total].slice(-4); const level = estimateLevel(profile, recentScores); const nextProfile: LearningProfile = { ...profile, completedMissionIds, currentMissionId: missions.find((mission) => !completedMissionIds.includes(mission.id))?.id ?? missions.at(-1)?.id, estimatedLevel: level.level, levelConfidence: level.confidence, updatedAt: Date.now() }; const nextState: PersistedState = { ...state, mastery: nextMastery, profiles: state.profiles.map((item) => item.id === profile.id ? nextProfile : item), missionProgress: { ...state.missionProgress, [activeMission.id]: { missionId: activeMission.id, status: "completed", score: score.total, completedAt: Date.now() } } }; setState(nextState); await storageRepository.saveState(nextState); setView("home"); };
  const reset = async () => { if (!window.confirm("Réinitialiser toute la progression Bibata sur cet appareil ?")) return; await storageRepository.reset(); setState(structuredClone(emptyState)); setView("onboarding-language"); };
  const importData = async (value: string) => { try { const imported = await storageRepository.importJSON(value); setState(imported); setView(imported.profiles.length ? "home" : "onboarding-language"); } catch { window.alert("Cette sauvegarde n’est pas valide."); } };
  if (loading) return <main className="loading-screen"><Logo /><span className="loading-dot" /></main>;
  if (view === "onboarding-language") return <OnboardingLanguage onChoose={chooseLanguage} />;
  if (view === "onboarding-interests") return <OnboardingInterests onBack={() => setView("onboarding-language")} onContinue={finishOnboarding} />;
  if (view === "mission") return <MissionFlow key={activeMission.id} mission={activeMission} onExit={() => setView(profile ? "home" : "onboarding-interests")} onFinish={finishMission} />;
  if (!profile) return <OnboardingLanguage onChoose={chooseLanguage} />;
  if (view === "progress") return <ProgressScreen profile={profile} masteryCount={learnedCount} onNavigate={setView} />;
  if (view === "settings") return <SettingsScreen onNavigate={setView} onReset={reset} onImport={importData} />;
  return <HomeScreen profile={profile} learnedCount={learnedCount} onContinue={startMission} onNavigate={setView} onAddLanguage={() => setView("onboarding-language")} />;
}
