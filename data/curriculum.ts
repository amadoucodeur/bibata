import type { CEFRLevel, Concept, ConceptType, Exercise, Mission, Roadmap } from "@/types/learning";

export const languages = [
  { code: "en", name: "English", flag: "🇬🇧", availability: "available" as const },
  { code: "es", name: "Español", flag: "🇪🇸", availability: "preview" as const },
  { code: "de", name: "Deutsch", flag: "🇩🇪", availability: "preview" as const },
  { code: "it", name: "Italiano", flag: "🇮🇹", availability: "preview" as const },
];

export const interestOptions = [
  { id: "travel", label: "Voyage", icon: "✈" },
  { id: "music", label: "Musique", icon: "♫" },
  { id: "technology", label: "Technologie", icon: "⌘" },
  { id: "cinema", label: "Cinéma", icon: "◉" },
  { id: "sport", label: "Sport", icon: "⚽" },
  { id: "food", label: "Cuisine", icon: "♨" },
  { id: "science", label: "Science", icon: "✦" },
  { id: "business", label: "Business", icon: "↗" },
];

const concept = (
  id: string,
  level: CEFRLevel,
  type: ConceptType,
  value: string,
  translation: string,
  category: string,
  example: string,
  exampleTranslation: string,
  explanation?: string,
): Concept => ({
  id,
  language: "en",
  type,
  value,
  translation,
  explanation,
  level,
  categories: [category],
  examples: [{ text: example, translation: exampleTranslation }],
});

export const concepts: Concept[] = [
  concept("hello", "A1", "word", "Hello", "Bonjour", "introductions", "Hello, I'm Noah.", "Bonjour, je suis Noah."),
  concept("nice-to-meet-you", "A1", "expression", "Nice to meet you", "Enchanté·e", "introductions", "Nice to meet you, Awa!", "Enchanté de te rencontrer, Awa !"),
  concept("where-from", "A1", "construction", "Where are you from?", "D'où viens-tu ?", "introductions", "Where are you from, Lina?", "D'où viens-tu, Lina ?"),
  concept("usually", "A1", "word", "usually", "d'habitude", "routine", "I usually wake up at seven.", "Je me réveille d'habitude à sept heures."),
  concept("wake-up", "A1", "phrasal_verb", "wake up", "se réveiller", "routine", "I wake up early on weekdays.", "Je me réveille tôt en semaine."),
  concept("after-work", "A1", "expression", "after work", "après le travail", "routine", "I listen to music after work.", "J'écoute de la musique après le travail."),

  concept("are-you-free", "A2", "construction", "Are you free…?", "Est-ce que tu es disponible… ?", "plans", "Are you free this Saturday?", "Est-ce que tu es disponible ce samedi ?"),
  concept("how-about", "A2", "construction", "How about…?", "Et si… ?", "plans", "How about meeting at six?", "Et si on se retrouvait à six heures ?"),
  concept("sounds-good", "A2", "expression", "That sounds good", "Ça me va", "plans", "Six o'clock? That sounds good.", "Six heures ? Ça me va."),
  concept("take-the-bus", "A2", "collocation", "take the bus", "prendre le bus", "city", "You can take the bus from here.", "Tu peux prendre le bus d'ici."),
  concept("turn-left", "A2", "collocation", "turn left", "tourner à gauche", "city", "Turn left after the bank.", "Tourne à gauche après la banque."),
  concept("how-long", "A2", "construction", "How long does it take?", "Combien de temps cela prend-il ?", "city", "How long does it take by bus?", "Combien de temps cela prend-il en bus ?"),

  concept("used-to", "B1", "grammar", "used to", "avoir l'habitude de", "storytelling", "I used to live near the sea.", "J'habitais autrefois près de la mer."),
  concept("ended-up", "B1", "phrasal_verb", "ended up", "finir par", "storytelling", "We ended up staying for a year.", "Nous avons fini par rester un an."),
  concept("what-happened-was", "B1", "construction", "What happened was…", "Ce qui s'est passé, c'est que…", "storytelling", "What happened was, I missed the last train.", "Ce qui s'est passé, c'est que j'ai raté le dernier train."),
  concept("in-my-view", "B1", "expression", "In my view", "À mon avis", "opinion", "In my view, flexible hours work better.", "À mon avis, les horaires flexibles fonctionnent mieux."),
  concept("main-reason", "B1", "collocation", "the main reason", "la raison principale", "opinion", "The main reason is that it saves time.", "La raison principale est que cela fait gagner du temps."),
  concept("however", "B1", "word", "however", "cependant", "opinion", "It is convenient; however, it can be expensive.", "C'est pratique ; cependant, cela peut coûter cher."),

  concept("bring-up", "B2", "phrasal_verb", "bring up", "aborder un sujet", "discussion", "I'd like to bring up one concern.", "J'aimerais aborder une préoccupation."),
  concept("see-your-point", "B2", "expression", "I see your point", "Je comprends ton point de vue", "discussion", "I see your point, but the timing still worries me.", "Je comprends ton point de vue, mais le calendrier m'inquiète encore."),
  concept("not-necessarily", "B2", "expression", "not necessarily", "pas forcément", "discussion", "More options do not necessarily mean a better choice.", "Plus d'options ne signifie pas forcément un meilleur choix."),
  concept("trade-off", "B2", "word", "trade-off", "compromis entre deux avantages", "problem-solving", "There is a trade-off between speed and quality.", "Il y a un compromis entre la rapidité et la qualité."),
  concept("work-around", "B2", "word", "workaround", "solution de contournement", "problem-solving", "We found a temporary workaround.", "Nous avons trouvé une solution de contournement temporaire."),
  concept("agree-on", "B2", "phrasal_verb", "agree on", "se mettre d'accord sur", "problem-solving", "Let's agree on the priorities first.", "Mettons-nous d'abord d'accord sur les priorités."),

  concept("to-some-extent", "C1", "expression", "to some extent", "dans une certaine mesure", "nuance", "That is true to some extent, but the evidence is incomplete.", "C'est vrai dans une certaine mesure, mais les preuves sont incomplètes."),
  concept("nonetheless", "C1", "word", "nonetheless", "néanmoins", "nuance", "The approach is risky; nonetheless, it deserves consideration.", "L'approche est risquée ; néanmoins, elle mérite d'être examinée."),
  concept("underlying-assumption", "C1", "collocation", "underlying assumption", "hypothèse sous-jacente", "nuance", "The underlying assumption may no longer be valid.", "L'hypothèse sous-jacente n'est peut-être plus valable."),
  concept("address-concern", "C1", "collocation", "address a concern", "répondre à une préoccupation", "leadership", "Let me address your main concern directly.", "Permettez-moi de répondre directement à votre principale préoccupation."),
  concept("accountability", "C1", "word", "accountability", "responsabilisation", "leadership", "Clear accountability prevents the same mistake.", "Une responsabilisation claire évite que la même erreur se répète."),
  concept("common-ground", "C1", "collocation", "common ground", "terrain d'entente", "leadership", "We need to find common ground before deciding.", "Nous devons trouver un terrain d'entente avant de décider."),

  concept("understatement", "C2", "word", "understatement", "euphémisme / litote", "subtext", "Calling the crisis ‘inconvenient’ is an understatement.", "Qualifier la crise de « gênante » est un euphémisme.", "Une formulation volontairement atténuée dont le sens réel est plus fort."),
  concept("implication", "C2", "word", "implication", "sous-entendu", "subtext", "The implication was clear, although nobody said it outright.", "Le sous-entendu était clair, même si personne ne l'a formulé directement."),
  concept("tongue-in-cheek", "C2", "expression", "tongue-in-cheek", "au second degré", "subtext", "Her comment was clearly tongue-in-cheek.", "Sa remarque était clairement au second degré."),
  concept("caveat", "C2", "word", "caveat", "réserve importante", "rhetoric", "The proposal is convincing, with one important caveat.", "La proposition est convaincante, avec une réserve importante."),
  concept("compelling-case", "C2", "collocation", "a compelling case", "un argumentaire convaincant", "rhetoric", "She made a compelling case for changing course.", "Elle a présenté un argumentaire convaincant pour changer de cap."),
  concept("reframe", "C2", "word", "reframe", "reformuler sous un autre angle", "rhetoric", "Let me reframe the question in practical terms.", "Permettez-moi de reformuler la question en termes pratiques."),
];

const choice = (id: string, conceptId: string, prompt: string, choices: string[], answer: string, difficulty: number): Exercise => ({
  id, type: "multiple_choice", concepts: [conceptId], prompt, difficulty,
  payload: { choices, answer }, evaluationMode: "local",
});

const blank = (id: string, conceptId: string, prompt: string, choices: string[], answer: string, difficulty: number): Exercise => ({
  id, type: "fill_blank", concepts: [conceptId], prompt, difficulty,
  payload: { choices, answer }, evaluationMode: "local",
});

const builder = (id: string, conceptId: string, prompt: string, tokens: string[], answer: string, difficulty: number): Exercise => ({
  id, type: "sentence_builder", concepts: [conceptId], prompt, difficulty,
  payload: { tokens, answer }, evaluationMode: "local",
});

const mission = (level: CEFRLevel, value: Omit<Mission, "level" | "worldId">): Mission => ({
  ...value,
  level,
  worldId: "foundations",
});

export const missionsByLevel: Record<CEFRLevel, Mission[]> = {
  A1: [
    mission("A1", {
      id: "nice-to-meet-you", order: 1, title: "Nice to Meet You", eyebrow: "Premiers échanges",
      description: "Salue quelqu'un, présente-toi et lance une conversation très simple.", durationMinutes: 5,
      conceptIds: ["hello", "nice-to-meet-you", "where-from"],
      exercises: [
        choice("hello-choice", "hello", "Que signifie “Hello” ?", ["Bonjour", "Au revoir", "Merci"], "Bonjour", 0.1),
        blank("meet-blank", "nice-to-meet-you", "Nice to ___ you.", ["meet", "from", "name"], "meet", 0.2),
        builder("from-build", "where-from", "Construis : D'où viens-tu ?", ["from", "Where", "you", "are"], "Where are you from", 0.3),
      ],
      conversation: { id: "intro-party", title: "Une première rencontre", setting: "Tu arrives à une soirée. Bibata vient te saluer.", characterName: "Bibata", characterRole: "Nouvelle connaissance", objectives: ["saluer", "te présenter", "dire d'où tu viens"], targetConcepts: ["hello", "nice-to-meet-you", "where-from"], suggestedReplies: ["Hello! I'm Alex.", "Nice to meet you!", "I'm from Abidjan."], opening: "Hi! I'm Bibata. What's your name?" },
    }),
    mission("A1", {
      id: "my-everyday-life", order: 2, title: "My Everyday Life", eyebrow: "Ta journée",
      description: "Parle simplement de tes habitudes et de ton rythme quotidien.", durationMinutes: 6,
      conceptIds: ["usually", "wake-up", "after-work"],
      exercises: [
        choice("usually-choice", "usually", "Que signifie “usually” ?", ["d'habitude", "rarement", "demain"], "d'habitude", 0.25),
        blank("wake-blank", "wake-up", "I ___ up at seven.", ["wake", "start", "meet"], "wake", 0.3),
        builder("work-build", "after-work", "Construis : J'écoute de la musique après le travail.", ["work", "I", "music", "after", "listen to"], "I listen to music after work", 0.4),
      ],
      conversation: { id: "daily-routine", title: "Pause-café au bureau", setting: "Sam te demande à quoi ressemble ta journée.", characterName: "Sam", characterRole: "Collègue", objectives: ["parler de ton réveil", "indiquer une habitude", "parler de l'après-travail"], targetConcepts: ["usually", "wake-up", "after-work"], suggestedReplies: ["I usually wake up at seven.", "I work in the morning.", "I listen to music after work."], opening: "Hey! What does a normal day look like for you?" },
    }),
  ],
  A2: [
    mission("A2", {
      id: "make-a-plan-a2", order: 1, title: "Make a Plan", eyebrow: "Organiser une sortie",
      description: "Propose une activité, vérifie une disponibilité et fixe un rendez-vous.", durationMinutes: 6,
      conceptIds: ["are-you-free", "how-about", "sounds-good"],
      exercises: [
        choice("free-choice-a2", "are-you-free", "“Are you free?” demande si la personne est…", ["disponible", "fatiguée", "perdue"], "disponible", 0.3),
        blank("about-blank-a2", "how-about", "How ___ meeting at six?", ["about", "long", "often"], "about", 0.38),
        builder("sounds-build-a2", "sounds-good", "Construis : Ça me va.", ["good", "That", "sounds"], "That sounds good", 0.45),
      ],
      conversation: { id: "weekend-plan-a2", title: "Un plan pour samedi", setting: "Bibata veut organiser une sortie avec toi ce week-end.", characterName: "Bibata", characterRole: "Amie", objectives: ["demander une disponibilité", "proposer une heure", "confirmer le plan"], targetConcepts: ["are-you-free", "how-about", "sounds-good"], suggestedReplies: ["Yes, I'm free on Saturday.", "How about meeting at six?", "That sounds good!"], opening: "Hey! Are you free this Saturday?" },
    }),
    mission("A2", {
      id: "getting-around-a2", order: 2, title: "Getting Around", eyebrow: "Se repérer en ville",
      description: "Demande ton chemin et comprends des indications courantes.", durationMinutes: 7,
      conceptIds: ["take-the-bus", "turn-left", "how-long"],
      exercises: [
        choice("bus-choice-a2", "take-the-bus", "Comment dit-on « prendre le bus » ?", ["take the bus", "drive the bus", "walk the bus"], "take the bus", 0.32),
        blank("left-blank-a2", "turn-left", "Turn ___ after the bank.", ["left", "bus", "long"], "left", 0.4),
        builder("long-build-a2", "how-long", "Construis : Combien de temps cela prend-il ?", ["take", "How long", "it", "does"], "How long does it take", 0.48),
      ],
      conversation: { id: "directions-a2", title: "Trouver le musée", setting: "Tu demandes à Jordan comment rejoindre le musée depuis la gare.", characterName: "Jordan", characterRole: "Habitant du quartier", objectives: ["demander un trajet", "vérifier une direction", "demander la durée"], targetConcepts: ["take-the-bus", "turn-left", "how-long"], suggestedReplies: ["Can I take the bus?", "Do I turn left after the bank?", "How long does it take?"], opening: "Hi! You look a little lost. Where are you trying to go?" },
    }),
  ],
  B1: [
    mission("B1", {
      id: "tell-your-story-b1", order: 1, title: "Tell Your Story", eyebrow: "Raconter un changement",
      description: "Relie le passé et le présent pour raconter une expérience avec naturel.", durationMinutes: 7,
      conceptIds: ["used-to", "ended-up", "what-happened-was"],
      exercises: [
        choice("used-choice-b1", "used-to", "Which sentence describes a past habit?", ["I used to live there.", "I am living there now.", "I will live there."], "I used to live there.", 0.48),
        blank("ended-blank-b1", "ended-up", "We ended ___ staying for a year.", ["up", "on", "out"], "up", 0.52),
        builder("happened-build-b1", "what-happened-was", "Construis le début d'une explication.", ["was", "What happened", "I missed", "the train"], "What happened was I missed the train", 0.58),
      ],
      conversation: { id: "life-change-b1", title: "Le choix qui a tout changé", setting: "Daniel te demande comment tu as commencé ton activité actuelle.", characterName: "Daniel", characterRole: "Nouvelle connaissance", objectives: ["décrire une ancienne habitude", "raconter un imprévu", "expliquer le résultat"], targetConcepts: ["used-to", "ended-up", "what-happened-was"], suggestedReplies: ["I used to work in a different field.", "What happened was, I met the right person.", "I ended up changing careers."], opening: "You mentioned a big change in your life. How did it all start?" },
    }),
    mission("B1", {
      id: "share-your-opinion-b1", order: 2, title: "Share Your Opinion", eyebrow: "Expliquer son point de vue",
      description: "Exprime une opinion, justifie-la et ajoute une réserve claire.", durationMinutes: 7,
      conceptIds: ["in-my-view", "main-reason", "however"],
      exercises: [
        choice("view-choice-b1", "in-my-view", "Which phrase introduces a personal opinion?", ["In my view", "As a result", "For example"], "In my view", 0.48),
        blank("reason-blank-b1", "main-reason", "The main ___ is that it saves time.", ["reason", "view", "result"], "reason", 0.55),
        builder("however-build-b1", "however", "Relie l'idée à sa réserve.", ["however", "It is useful", "it can be costly"], "It is useful however it can be costly", 0.6),
      ],
      conversation: { id: "remote-work-b1", title: "Faut-il travailler à distance ?", setting: "Nora échange avec toi sur les avantages du télétravail.", characterName: "Nora", characterRole: "Collègue", objectives: ["donner ton avis", "le justifier", "ajouter une limite"], targetConcepts: ["in-my-view", "main-reason", "however"], suggestedReplies: ["In my view, it gives people more flexibility.", "The main reason is that it saves time.", "However, teamwork can be harder."], opening: "Do you think working from home is better for everyone?" },
    }),
  ],
  B2: [
    mission("B2", {
      id: "read-the-room-b2", order: 1, title: "Read the Room", eyebrow: "Nuancer un désaccord",
      description: "Aborde un sujet délicat, reconnais l'autre point de vue et pose une limite.", durationMinutes: 8,
      conceptIds: ["bring-up", "see-your-point", "not-necessarily"],
      exercises: [
        choice("bring-choice-b2", "bring-up", "To “bring up a concern” means to…", ["introduce it for discussion", "solve it silently", "dismiss it completely"], "introduce it for discussion", 0.62),
        blank("point-blank-b2", "see-your-point", "I see your ___, but the timing worries me.", ["point", "reason", "side"], "point", 0.65),
        builder("necessarily-build-b2", "not-necessarily", "Formule un désaccord nuancé.", ["the best option", "not necessarily", "The fastest route is"], "The fastest route is not necessarily the best option", 0.7),
      ],
      conversation: { id: "team-meeting-b2", title: "Une décision trop rapide", setting: "Lors d'une réunion, Alex veut lancer le projet dès demain. Tu as des réserves.", characterName: "Alex", characterRole: "Chef de projet", objectives: ["aborder ta réserve", "reconnaître son argument", "nuancer la conclusion"], targetConcepts: ["bring-up", "see-your-point", "not-necessarily"], suggestedReplies: ["I'd like to bring up one concern.", "I see your point, but we need more data.", "Starting tomorrow is not necessarily the safest option."], opening: "I think we're ready to launch tomorrow. Does anyone disagree?" },
    }),
    mission("B2", {
      id: "solve-it-together-b2", order: 2, title: "Solve It Together", eyebrow: "Négocier une solution",
      description: "Compare les contraintes et aide un groupe à construire une solution réaliste.", durationMinutes: 8,
      conceptIds: ["trade-off", "work-around", "agree-on"],
      exercises: [
        choice("trade-choice-b2", "trade-off", "A trade-off requires you to…", ["balance competing benefits", "avoid every decision", "choose without a cost"], "balance competing benefits", 0.64),
        blank("workaround-blank-b2", "work-around", "We found a temporary ___.", ["workaround", "trade-off", "agreement"], "workaround", 0.68),
        builder("agree-build-b2", "agree-on", "Recentre le groupe sur une décision.", ["the priorities", "Let's", "first", "agree on"], "Let's agree on the priorities first", 0.72),
      ],
      conversation: { id: "deadline-b2", title: "Qualité ou délai ?", setting: "L'équipe ne peut pas tout livrer à temps. Priya cherche une solution.", characterName: "Priya", characterRole: "Responsable produit", objectives: ["nommer le compromis", "proposer un contournement", "obtenir un accord"], targetConcepts: ["trade-off", "work-around", "agree-on"], suggestedReplies: ["There is a trade-off between speed and quality.", "We could use a temporary workaround.", "Let's agree on the essential features first."], opening: "We cannot keep every feature and still meet Friday's deadline. What would you suggest?" },
    }),
  ],
  C1: [
    mission("C1", {
      id: "nuanced-view-c1", order: 1, title: "Defend a Nuanced View", eyebrow: "Raisonner avec précision",
      description: "Évalue une affirmation, dévoile ses présupposés et construis une position nuancée.", durationMinutes: 9,
      conceptIds: ["to-some-extent", "nonetheless", "underlying-assumption"],
      exercises: [
        choice("extent-choice-c1", "to-some-extent", "Which opening signals partial agreement?", ["To some extent", "Without exception", "By no means"], "To some extent", 0.74),
        blank("nonetheless-blank-c1", "nonetheless", "The evidence is limited; ___, the question deserves attention.", ["nonetheless", "therefore", "likewise"], "nonetheless", 0.78),
        builder("assumption-build-c1", "underlying-assumption", "Identifie ce qui doit être interrogé.", ["needs to be examined", "The underlying assumption", "more closely"], "The underlying assumption needs to be examined more closely", 0.82),
      ],
      conversation: { id: "policy-debate-c1", title: "Automatiser pour mieux décider ?", setting: "Dr. Morgan affirme que davantage de données produit toujours de meilleures décisions.", characterName: "Dr. Morgan", characterRole: "Chercheuse invitée", objectives: ["accorder partiellement", "identifier un présupposé", "défendre une réserve"], targetConcepts: ["to-some-extent", "nonetheless", "underlying-assumption"], suggestedReplies: ["That is true to some extent.", "The underlying assumption is that the data is unbiased.", "Nonetheless, human judgment still matters."], opening: "With enough data, institutions will inevitably make better decisions. Would you agree?" },
    }),
    mission("C1", {
      id: "difficult-conversation-c1", order: 2, title: "Lead a Difficult Conversation", eyebrow: "Créer un terrain d'entente",
      description: "Traite une préoccupation sans l'esquiver et conduis l'échange vers une responsabilité partagée.", durationMinutes: 9,
      conceptIds: ["address-concern", "accountability", "common-ground"],
      exercises: [
        choice("address-choice-c1", "address-concern", "To address a concern is to…", ["respond to it substantively", "mention it in passing", "redirect the conversation"], "respond to it substantively", 0.75),
        blank("accountability-blank-c1", "accountability", "Clear ___ prevents the same failure from recurring.", ["accountability", "agreement", "authority"], "accountability", 0.8),
        builder("ground-build-c1", "common-ground", "Ouvre la voie à une solution commune.", ["before we decide", "some common ground", "Let's find"], "Let's find some common ground before we decide", 0.84),
      ],
      conversation: { id: "partnership-c1", title: "Une collaboration fragilisée", setting: "Amina estime que ton équipe n'a pas respecté ses engagements.", characterName: "Amina", characterRole: "Partenaire stratégique", objectives: ["répondre à la préoccupation", "clarifier la responsabilité", "retrouver un terrain d'entente"], targetConcepts: ["address-concern", "accountability", "common-ground"], suggestedReplies: ["Let me address your main concern directly.", "We need clearer accountability on both sides.", "I believe we can still find common ground."], opening: "We upheld our side of the agreement, but your team repeatedly missed its commitments." },
    }),
  ],
  C2: [
    mission("C2", {
      id: "between-the-lines-c2", order: 1, title: "Between the Lines", eyebrow: "Décoder le sous-texte",
      description: "Interprète l'ironie, l'atténuation et les intentions qui ne sont jamais formulées directement.", durationMinutes: 10,
      conceptIds: ["understatement", "implication", "tongue-in-cheek"],
      exercises: [
        choice("understatement-choice-c2", "understatement", "Calling a disastrous launch “a slight hiccup” is primarily…", ["an understatement", "a literal assessment", "a formal concession"], "an understatement", 0.86),
        blank("implication-blank-c2", "implication", "The ___ was unmistakable, although it was never stated outright.", ["implication", "translation", "premise"], "implication", 0.88),
        builder("tongue-build-c2", "tongue-in-cheek", "Précise que la remarque n'était pas littérale.", ["was", "entirely", "His remark", "tongue-in-cheek"], "His remark was entirely tongue-in-cheek", 0.9),
      ],
      conversation: { id: "subtext-c2", title: "Un compliment à double tranchant", setting: "Après une présentation tendue, Eleanor fait une remarque volontairement ambiguë.", characterName: "Eleanor", characterRole: "Éditrice", objectives: ["identifier l'atténuation", "expliciter le sous-entendu", "répondre au second degré"], targetConcepts: ["understatement", "implication", "tongue-in-cheek"], suggestedReplies: ["Calling it ‘eventful’ may be an understatement.", "The implication seems to be that we were unprepared.", "I assume that last remark was tongue-in-cheek."], opening: "Well, that was certainly an ‘eventful’ presentation. You do enjoy keeping an audience alert." },
    }),
    mission("C2", {
      id: "persuade-with-precision-c2", order: 2, title: "Persuade with Precision", eyebrow: "Maîtriser le cadrage",
      description: "Anticipe les objections et recadre un débat sans simplifier la complexité.", durationMinutes: 10,
      conceptIds: ["caveat", "compelling-case", "reframe"],
      exercises: [
        choice("caveat-choice-c2", "caveat", "A caveat in an argument is…", ["a qualification or warning", "its strongest evidence", "an emotional appeal"], "a qualification or warning", 0.87),
        blank("compelling-blank-c2", "compelling-case", "She made a ___ case for changing course.", ["compelling", "compliant", "convenient"], "compelling", 0.9),
        builder("reframe-build-c2", "reframe", "Déplace le débat vers son enjeu réel.", ["the question", "Let me", "in practical terms", "reframe"], "Let me reframe the question in practical terms", 0.92),
      ],
      conversation: { id: "boardroom-c2", title: "Convaincre sans surpromettre", setting: "Un comité sceptique met en doute la pertinence de ta proposition.", characterName: "Julian", characterRole: "Membre du comité", objectives: ["formuler une réserve", "construire l'argument central", "recadrer l'objection"], targetConcepts: ["caveat", "compelling-case", "reframe"], suggestedReplies: ["There is one important caveat we should acknowledge.", "The long-term evidence makes a compelling case.", "Let me reframe the question in terms of opportunity cost."], opening: "Your proposal is polished, but I remain unconvinced that it addresses the problem we actually have." },
    }),
  ],
};

export const trackMetaByLevel: Record<CEFRLevel, { title: string; eyebrow: string }> = {
  A1: { title: "Foundations", eyebrow: "Prendre confiance" },
  A2: { title: "Everyday Autonomy", eyebrow: "Gagner en autonomie" },
  B1: { title: "Expression", eyebrow: "Raconter et expliquer" },
  B2: { title: "Fluency", eyebrow: "Nuancer et résoudre" },
  C1: { title: "Precision", eyebrow: "Structurer sa pensée" },
  C2: { title: "Mastery", eyebrow: "Lire et manier les sous-entendus" },
};

// Alias historique : les tests et anciennes sauvegardes A1 conservent leurs identifiants.
export const missions = missionsByLevel.A1;

export const roadmap: Roadmap = {
  language: "en",
  worlds: [
    { id: "foundations", title: "Foundations", eyebrow: "Prendre confiance", accent: "mint", missionIds: missions.map((item) => item.id) },
    { id: "city-life", title: "City Life", eyebrow: "Se débrouiller en ville", accent: "blue", missionIds: ["at-the-cafe", "finding-your-way"] },
    { id: "travel", title: "Travel", eyebrow: "Partir plus loin", accent: "peach", missionIds: ["airport", "hotel"] },
  ],
};

export const getConcept = (id: string) => concepts.find((item) => item.id === id);
export const getMissionsForLevel = (level: CEFRLevel = "A1") => missionsByLevel[level];
export const getTrackMeta = (level: CEFRLevel = "A1") => trackMetaByLevel[level];
export const getMission = (id?: string) => Object.values(missionsByLevel).flat().find((item) => item.id === id) ?? missions[0];
