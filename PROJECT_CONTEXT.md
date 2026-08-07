# Projet : Bibata

Tu es chargé de concevoir et développer la première version de **Bibata**, une application mobile-first d’apprentissage ludique et adaptatif des langues, principalement centrée sur le vocabulaire, les expressions et certaines constructions grammaticales.

Bibata ne doit pas ressembler à une plateforme scolaire classique ni à un simple chatbot IA.

L’objectif est de créer une expérience d’apprentissage extrêmement simple, rapide, intuitive, belle et immersive dans laquelle l’utilisateur apprend des concepts, les rencontre en contexte, les pratique puis les utilise dans des situations simulées avec une IA conversationnelle.

---

# 1. PRINCIPES FONDAMENTAUX

Les principes suivants sont non négociables.

## 1.1 Mobile first

L’application doit être conçue d’abord pour smartphone.

Ne pas concevoir un dashboard desktop puis essayer de l’adapter au mobile.

La largeur, les interactions, les boutons, les espacements, les animations, les formulaires et les navigations doivent être pensés en priorité pour :

* iPhone ;
* Android ;
* PWA/mobile web.

L’expérience desktop peut utiliser plus d’espace, mais doit rester une extension naturelle de l’expérience mobile.

Les boutons interactifs doivent avoir des zones tactiles suffisamment grandes.

Éviter les interfaces surchargées.

Éviter les tableaux.

Éviter les dashboards complexes.

Éviter les menus contenant trop d’options.

---

## 1.2 UX avant tout

L’ordre des priorités du projet est :

1. simplicité ;
2. rapidité ;
3. intuitivité ;
4. esthétique ;
5. robustesse ;
6. intelligence/adaptation ;
7. quantité de fonctionnalités.

Une fonctionnalité intelligente mais gênante pour l’utilisateur doit être simplifiée ou supprimée.

L’utilisateur doit avoir autant que possible cette sensation :

> j’ouvre Bibata → je continue mon apprentissage → je joue.

Pas :

> j’ouvre → dashboard → catégorie → sous-catégorie → menu → configuration → exercice.

---

# 2. POSITIONNEMENT DU PRODUIT

Bibata est un jeu/app d’apprentissage adaptatif.

Le principe fondamental est :

> Le joueur ne suit pas simplement un cours prédéfini. Bibata découvre progressivement ce qu’il sait, ce qu’il aime et ce qu’il doit apprendre, puis adapte son parcours.

L’adaptation doit être presque invisible.

Ne pas afficher constamment :

> « L’IA personnalise votre apprentissage ».

L’utilisateur doit simplement ressentir que :

* les exercices sont adaptés ;
* les sujets l’intéressent ;
* le niveau n’est ni trop facile ni trop difficile ;
* des notions anciennes réapparaissent naturellement ;
* il progresse ;
* il devient capable d’utiliser réellement la langue.

---

# 3. NOM

Le nom du produit est :

**Bibata**

Utiliser simplement `Bibata` comme marque.

Ne pas inventer d’acronyme artificiel autour du nom.

---

# 4. CIBLE DE LA V1

La V1 doit permettre à quelqu’un :

* totalement débutant ;
* ou ayant déjà un certain niveau ;

de commencer immédiatement.

Le système doit être adaptatif.

La V1 doit rester volontairement légère.

Ne pas construire pour l’instant :

* système d’authentification ;
* comptes utilisateurs distants ;
* back-office ;
* dashboard administrateur ;
* organisations ;
* rôles ;
* gestion SaaS complexe ;
* paiement ;
* abonnement ;
* classement social ;
* amis ;
* backend métier complexe.

L’état utilisateur doit pouvoir être géré localement.

---

# 5. STACK TECHNIQUE SOUHAITÉE

Construire l’application avec une architecture moderne basée de préférence sur :

* Next.js avec App Router ;
* TypeScript ;
* React ;
* Tailwind CSS ;
* composants accessibles et réutilisables ;
* éventuellement shadcn/ui quand pertinent ;
* IndexedDB pour les données utilisateur importantes ;
* localStorage uniquement pour de petits paramètres simples.

Privilégier une architecture claire mais pas inutilement complexe.

Ne pas introduire Redux si ce n’est pas nécessaire.

Pour l’état global léger, choisir une solution simple telle que Zustand si nécessaire.

Ne pas installer une grande quantité de dépendances sans justification.

---

# 6. ARCHITECTURE LOCAL-FIRST

Dans cette première version, les profils et progressions doivent fonctionner localement.

Architecture générale :

Client
│
├── profil utilisateur
├── langues étudiées
├── centres d’intérêt
├── progression
├── concepts
├── historique
├── scores
├── roadmap
├── exercices préchargés
└── paramètres
↓
IndexedDB

Les données pédagogiques de base peuvent être livrées sous forme de fichiers JSON/TypeScript locaux.

Prévoir une architecture permettant plus tard de remplacer ou synchroniser IndexedDB avec Supabase/PostgreSQL sans réécrire le moteur pédagogique.

Créer donc des abstractions propres autour du stockage.

Par exemple :

StorageRepository
├── getLearningProfile()
├── saveLearningProfile()
├── getConceptMastery()
├── saveConceptMastery()
├── getRoadmap()
└── saveRoadmap()

Ne pas coupler toute l’application directement à IndexedDB.

---

# 7. INTÉGRATION IA

L’IA sera principalement utilisée pour :

* contextualiser des concepts ;
* générer certains exercices ;
* adapter légèrement certaines missions ;
* générer des situations ;
* jouer les personnages dans les simulations ;
* analyser certaines réponses libres ;
* proposer des explications ;
* éventuellement proposer des missions personnalisées.

L’IA ne doit PAS être responsable de toute la logique pédagogique.

Séparer :

1. Curriculum Engine ;
2. Learner Model ;
3. Game Engine ;
4. AI Engine.

Architecture conceptuelle :

Learner Model
│
↓
Curriculum Engine
│
↓
Game Engine
│
↔
AI Engine

L’IA est un outil du moteur pédagogique, pas son cerveau unique.

---

# 8. ABSTRACTION DU FOURNISSEUR IA

Créer une abstraction :

AIProvider

avec par exemple :

generateExercise()
generateContext()
evaluateFreeAnswer()
generateConversationTurn()
generateCustomMission()

Le fournisseur réel doit pouvoir être changé facilement.

Ne pas disperser directement les appels API dans les composants React.

La première version peut fonctionner avec des appels directs côté client si nécessaire pour le prototype.

Cependant, isoler complètement cette logique afin qu’il soit possible plus tard de déplacer les appels vers :

/api/ai

sans modifier le reste de l’application.

Ne jamais coder la logique métier autour d’un fournisseur spécifique.

---

# 9. LATENCE IA

Principe fondamental :

**la boucle normale de jeu ne doit pas dépendre d’un appel IA en temps réel.**

Éviter absolument :

question
→ appel IA
→ loading
→ réponse
→ nouvelle question
→ appel IA

Préférer :

IA
→ génération d’un batch d’exercices
→ cache local
→ jeu instantané

Pendant que le joueur utilise les exercices disponibles, de nouveaux exercices peuvent éventuellement être préparés.

Les exercices déterministes doivent être corrigés localement :

* QCM ;
* image → mot ;
* mot → image ;
* association ;
* vrai/faux ;
* reconstruction ;
* texte à trous avec réponse connue ;
* traduction simple connue ;
* choix multiples.

Les appels IA temps réel doivent surtout servir à :

* conversation ;
* réponse libre complexe ;
* explication personnalisée.

---

# 10. IMAGES

Ne pas générer d’images avec IA dans la V1.

La génération d’images est :

* trop lente ;
* trop coûteuse ;
* inutile pour beaucoup de vocabulaire.

Prévoir une abstraction `ImageProvider`.

Les images peuvent venir de fournisseurs externes tels que :

* Pexels ;
* Pixabay ;
* Unsplash ;
* autre fournisseur adapté.

Lorsqu’une image pertinente est trouvée, éviter de refaire constamment la recherche.

Pouvoir associer au concept :

* imageUrl ;
* imageQuery ;
* provider ;
* attribution éventuelle.

Pour les concepts extrêmement simples, emoji ou illustration CSS peuvent suffire.

Pour les concepts abstraits ou grammaticaux, ne pas forcer l’utilisation d’une image.

---

# 11. CONCEPTS PÉDAGOGIQUES

Le système ne doit pas être basé exclusivement sur des « mots ».

Créer l’entité générique :

`Concept`

Un Concept peut représenter :

* word ;
* expression ;
* phrasal verb ;
* collocation ;
* grammar ;
* construction.

Exemples :

word:
`airport`

expression:
`How are you?`

phrasal verb:
`give up`

collocation:
`make a decision`

construction:
`would like + noun`

grammar:
`plural -s`

Structure indicative :

```ts
type ConceptType =
  | "word"
  | "expression"
  | "phrasal_verb"
  | "collocation"
  | "construction"
  | "grammar";

interface Concept {
  id: string;
  language: string;
  type: ConceptType;

  value: string;

  translation?: string;
  explanation?: string;

  level?: CEFRLevel;

  categories: string[];
  prerequisites?: string[];

  examples: ConceptExample[];

  imageQuery?: string;

  metadata?: Record<string, unknown>;
}
```

---

# 12. PROFIL D’APPRENTISSAGE

Chaque langue possède son propre profil.

Exemple :

Utilisateur
├── English
│   ├── estimatedLevel
│   ├── concepts
│   ├── roadmap
│   └── progression
│
├── Spanish
│   ├── estimatedLevel
│   ├── concepts
│   └── roadmap
│
└── German
└── ...

Le même utilisateur peut donc être :

🇬🇧 Anglais : B1
🇪🇸 Espagnol : A1
🇩🇪 Allemand : débutant

Créer quelque chose de proche de :

```ts
interface LearningProfile {
  id: string;

  language: string;

  estimatedLevel?: CEFRLevel;
  levelConfidence: number;

  interests: string[];

  currentMissionId?: string;

  createdAt: number;
  updatedAt: number;
}
```

---

# 13. MULTI-LANGUE

L’utilisateur doit pouvoir apprendre plusieurs langues simultanément.

Ne jamais supposer qu’un utilisateur n’a qu’une seule langue active.

Écran principal possible :

Bibata

🇬🇧 English
A2
327 concepts

[ Continuer ]

🇪🇸 Español
A1
84 concepts

[ Continuer ]

* Apprendre une langue

Chaque langue possède :

* progression indépendante ;
* niveau indépendant ;
* roadmap indépendante ;
* concepts indépendants ;
* missions indépendantes.

---

# 14. ONBOARDING

Le premier lancement doit être extrêmement court.

Objectif :

faire entrer le joueur dans une première mission le plus vite possible.

Étapes :

## Étape 1

Choisir une langue à apprendre.

Exemple :

> Que veux-tu apprendre ?

🇬🇧 English
🇪🇸 Español
🇩🇪 Deutsch
etc.

Prévoir l’architecture multi-langue même si peu de langues sont réellement disponibles au départ.

---

## Étape 2

Centres d’intérêt.

Question :

> Qu’est-ce qui t’intéresse ?

Exemples :

* Technologie ;
* Musique ;
* Voyage ;
* Science ;
* Cinéma ;
* Sport ;
* Business ;
* Jeux vidéo.

Permettre :

`+ Ajouter`

L’utilisateur peut écrire :

* développement web ;
* cybersécurité ;
* astronomie ;
* rap ;
* football ivoirien ;
* etc.

Les intérêts servent principalement à contextualiser les exemples, missions et conversations.

Ils ne doivent pas complètement remplacer le programme pédagogique.

---

# 15. PAS DE TEST DE NIVEAU CLASSIQUE

Ne pas afficher :

> « Passe un test de 30 questions ».

Les premières missions servent simultanément à :

* apprendre ;
* divertir ;
* estimer le niveau.

Le système commence relativement simplement puis ajuste rapidement la difficulté.

Exemple :

Mission 1 :
A1 très simple.

Si presque tout est réussi :

→ augmenter rapidement la difficulté.

Tester ensuite A2.

Puis éventuellement B1.

Le moteur cherche progressivement la zone appropriée.

Le joueur doit avoir l’impression de jouer normalement.

---

# 16. NIVEAU ESTIMÉ

Utiliser les niveaux CECRL :

* A1 ;
* A2 ;
* B1 ;
* B2 ;
* C1 ;
* C2.

Le niveau est une **estimation**.

Afficher :

> Niveau estimé : A2

et non :

> Niveau officiel : A2.

Au début :

> Niveau en cours d’estimation…

Puis après suffisamment de données :

> Niveau estimé : A2

Internement conserver une confiance :

```ts
levelConfidence: 0.0 -> 1.0
```

Ne pas nécessairement afficher cette valeur brute.

---

# 17. LE NIVEAU DOIT ÊTRE CONTINU

Le niveau ne doit pas être déterminé une fois pour toutes.

Il doit évoluer suivant les performances.

Le moteur peut progressivement corriger son estimation.

Éviter cependant les changements brutaux et fréquents.

Utiliser du lissage.

Ne pas transformer une mauvaise mission en :

B1 → A2

immédiatement.

La tendance doit être évaluée sur plusieurs observations.

---

# 18. SCORE INTERNE PLUS RICHE QUE LE CECRL

Le CECRL affiché est une synthèse.

Le moteur peut conserver des dimensions internes :

```ts
interface LanguageAbility {
  vocabulary: number;
  grammar: number;
  comprehension: number;
  recall: number;
  production: number;
}
```

Exemple :

Vocabulary: 0.72
Grammar: 0.51
Comprehension: 0.81
Recall: 0.63
Production: 0.48

Ne pas forcément montrer ces nombres bruts au joueur.

---

# 19. ROADMAP

Chaque langue possède une feuille de route.

Utiliser une nomenclature plus ludique que :

module → chapitre.

Nomenclature principale :

**Monde → Mission**

Exemple :

English

🌱 Foundations
├── Nice to Meet You
├── My Everyday Life
├── Around the House
└── Time & Numbers

🌆 City Life
├── At the Café
├── Shopping
├── Finding Your Way
└── Public Transport

✈️ Travel
├── Airport
├── Hotel
├── Restaurant
└── Meeting People

💼 Work
├── At the Office
├── Meetings
├── Messages
└── Professional Introductions

---

# 20. ROADMAP HYBRIDE

La roadmap ne doit être :

ni totalement figée ;
ni totalement générée par IA.

Utiliser une stratégie hybride.

La structure pédagogique principale doit être contrôlée :

* niveau ;
* prérequis ;
* progression ;
* concepts indispensables ;
* difficulté.

L’IA peut personnaliser :

* contexte ;
* personnages ;
* exemples ;
* centres d’intérêt ;
* certaines situations ;
* certaines missions secondaires.

L’IA peut également proposer des missions personnalisées.

Exemple :

Intérêt utilisateur :
`cybersécurité`

Bibata peut créer plus tard :

🔐 Cybersecurity Basics

mais doit respecter :

* niveau de langue ;
* concepts prérequis ;
* progression pédagogique.

---

# 21. STABILITÉ DE LA ROADMAP

Ne pas modifier constamment tout le parcours.

Règles :

* missions terminées → immuables ;
* mission actuelle → stable ;
* prochaines missions proches → relativement stables ;
* missions futures → adaptables.

L’utilisateur doit toujours comprendre :

* où il est ;
* ce qu’il vient de terminer ;
* ce qui arrive ensuite.

---

# 22. STRUCTURE D’UNE MISSION

Chaque mission doit suivre approximativement cette boucle :

1. introduction ;
2. découverte ;
3. contexte ;
4. rappel/répétition ;
5. exercices ;
6. immersion IA ;
7. bilan.

Une mission doit pouvoir être terminée rapidement.

Cible initiale indicative :

environ 4 à 8 minutes.

Ne pas transformer chaque mission en cours de 30 minutes.

---

# 23. INTRODUCTION DE MISSION

Très courte.

Exemple :

☕ AT THE CAFÉ

Tu vas apprendre à :

* commander une boisson ;
* demander quelque chose ;
* payer.

≈ 5 min

[ Commencer ]

Maximum quelques secondes de lecture.

---

# 24. DÉCOUVERTE

Introduire un nombre raisonnable de concepts.

Cible indicative :

5 à 10 nouveaux concepts principaux par mission.

Exemple :

coffee
milk
sugar
cup
order
bill
please
would like

Ne pas afficher une énorme liste à mémoriser.

L’apprentissage doit rester interactif.

---

# 25. CONTEXTE

Un concept ne doit pas être appris uniquement comme :

`order = commander`

Présenter rapidement des exemples :

> I'd like to order a coffee.

> Can we order now?

Le contexte fait partie intégrante de l’apprentissage.

---

# 26. GRAMMAIRE

Bibata est principalement centré sur le vocabulaire mais enseigne aussi des constructions grammaticales.

Ne pas construire une expérience scolaire du type :

> Chapitre 4 : Present Perfect.

Préférer :

usage
↓
observation
↓
courte explication
↓
pratique

Exemple :

> I have visited London.

> She has visited London.

Puis éventuellement :

💡 `have/has + participe passé` peut notamment servir à parler d’une expérience passée liée au présent.

Puis retour immédiat au jeu.

---

# 27. RÉPÉTITION ACTIVE

Progressivement réduire l’aide.

Exemple :

### Reconnaissance

☕
coffee

### Choix

Que signifie `coffee` ?

### Rappel

☕

[ ______ ]

### Completion

I'd like a ___.

### Production

Use `coffee` in a sentence.

La progression doit aller de reconnaissance vers production.

---

# 28. TYPES D’EXERCICES

Prévoir une architecture extensible.

Commencer avec notamment :

* QCM ;
* image → mot ;
* mot → image ;
* texte à trous ;
* reconstruction de phrase ;
* association ;
* traduction ;
* vrai/faux ;
* intrus ;
* réponse courte ;
* phrase à compléter.

Créer des composants séparés par type.

Exemple :

components/exercises/
├── MultipleChoiceExercise
├── FillBlankExercise
├── MatchingExercise
├── ImageChoiceExercise
├── SentenceBuilderExercise
└── ShortAnswerExercise

Créer une interface commune :

```ts
interface Exercise {
  id: string;
  type: ExerciseType;

  concepts: string[];

  prompt: string;

  difficulty: number;

  payload: unknown;

  evaluationMode: "local" | "ai";
}
```

---

# 29. IMMERSION / SITUATION RÉELLE

À la fin d’une mission, placer l’utilisateur dans une situation simulée.

C’est un élément central de Bibata.

Exemple :

🎭 AT THE CAFÉ

> You enter a café in London.

Objectifs internes :

* saluer ;
* commander ;
* répondre sur le lait/sucre ;
* demander l’addition.

L’IA joue le serveur.

---

# 30. CONVERSATION CONTRAINTE PÉDAGOGIQUEMENT

La conversation ne doit PAS être un chatbot généraliste.

Le moteur fournit à l’IA :

* scénario ;
* niveau ;
* nouveaux concepts ;
* concepts précédemment maîtrisés ;
* concepts fragiles ;
* objectifs ;
* vocabulaire autorisé/préféré.

Exemple :

```json
{
  "scenario": "cafe",
  "estimatedLevel": "A2",

  "objectives": [
    "greet waiter",
    "order drink",
    "respond about milk",
    "ask for bill"
  ],

  "targetConcepts": [
    "coffee",
    "milk",
    "order",
    "bill",
    "would like"
  ],

  "weakConcepts": [
    "cup"
  ]
}
```

L’IA doit créer des occasions naturelles d’utiliser principalement les nouveaux concepts et certains concepts anciens.

---

# 31. NE PAS SUR-CORRIGER

Pendant les conversations, préserver le flow.

Exemple joueur :

> I want coffee with milk please.

Même si :

> I'd like a coffee with milk, please.

est plus naturel, le personnage doit pouvoir continuer :

> Sure! One coffee with milk.

Ne pas interrompre après chaque petite faute.

À la fin, éventuellement afficher :

💡 Une formulation plus naturelle :

> I'd like a coffee with milk, please.

L’immersion passe avant la correction obsessionnelle.

---

# 32. MAÎTRISE DES CONCEPTS

Ne pas utiliser uniquement :

`known = true / false`.

La maîtrise est progressive.

Exemple :

```ts
interface ConceptMastery {
  conceptId: string;

  exposureCount: number;

  recognition: number;
  recall: number;
  contextUnderstanding: number;
  production: number;

  masteryScore: number;
  confidence: number;

  correctCount: number;
  incorrectCount: number;

  lastSeenAt?: number;
  nextSuggestedExposureAt?: number;
}
```

Les scores peuvent être entre 0 et 1.

---

# 33. ÉTATS INTERNES

On peut dériver des états :

UNKNOWN
↓
SEEN
↓
FAMILIAR
↓
UNDERSTOOD
↓
MASTERED

Ces états sont surtout internes.

Ne pas surcharger l’interface avec cette complexité.

---

# 34. CONCEPT MAL MAÎTRISÉ

Principe important :

si l’utilisateur maîtrise mal un concept, ne pas le bloquer et ne pas lui imposer immédiatement une grosse session de rattrapage.

Exemple :

Mission terminée.

`bill` mastery = faible.

Le joueur continue quand même.

Le moteur garde l’information.

Quelques missions plus tard, `bill` peut apparaître naturellement dans :

* restaurant ;
* hôtel ;
* café ;
* voyage.

La répétition doit être intégrée au parcours.

---

# 35. RÉPÉTITION ESPACÉE INVISIBLE

Le moteur doit pouvoir réintroduire des concepts anciens.

Mais éviter que l’expérience soit constamment présentée comme :

> SESSION DE RÉVISION.

L’utilisateur apprend de nouveaux concepts tout en rencontrant naturellement les anciens.

Exemple :

Mission 3 :
`bill`

Mission 8 :
restaurant → `bill`

Mission 14 :
hotel bar → `bill`

Si les performances deviennent bonnes :

→ maîtrise renforcée.

---

# 36. BILAN DE MISSION

Le bilan doit être visuel et rapide.

Exemple :

MISSION TERMINÉE 🎉

87 %

Concepts
████████████████░░ 90 %

Compréhension
███████████████░░░ 82 %

Utilisation
████████████████░░ 88 %

+8 concepts appris

Total : 327

Ne pas noyer l’utilisateur sous les statistiques.

---

# 37. SCORE

Le score de mission doit prendre en compte plusieurs aspects :

* compréhension ;
* reconnaissance ;
* rappel ;
* utilisation ;
* performance dans les exercices ;
* performance dans l’immersion.

Les poids exacts pourront évoluer.

Créer le calcul dans un module séparé.

Ne pas hardcoder la logique directement dans l’UI.

---

# 38. NOMBRE DE CONCEPTS APPRIS

C’est une statistique importante.

Afficher facilement :

🧠 327 concepts

Puis éventuellement :

184 mots
47 expressions
16 constructions
etc.

Le nombre total doit être motivant.

---

# 39. DASHBOARD MINIMAL

L’écran principal doit être extrêmement simple.

Exemple mobile :

Bibata

Bonjour 👋

🇬🇧 English

A2
327 concepts

☕ At the Café
Mission 7 · ≈ 5 min

[ CONTINUER ]

────────────

🇪🇸 Español

A1
84 concepts

[ Continuer ]

* Apprendre une langue

Ne pas construire un dashboard SaaS.

---

# 40. ÉCRAN D’UNE LANGUE

Exemple :

English

Niveau estimé
A2

Progression vers B1
███████░░░

327 concepts appris
218 maîtrisés

Roadmap :

🌱 Foundations ✓
🌆 City Life ← actuel
✈️ Travel
💼 Work

[ Continuer ]

Cette page doit rester très lisible sur téléphone.

---

# 41. DESIGN

Créer une identité moderne.

Bibata doit donner l’impression d’une application grand public premium, pas d’un projet scolaire.

Principes :

* beaucoup d’espace ;
* hiérarchie typographique forte ;
* composants arrondis avec modération ;
* animations courtes ;
* transitions fluides ;
* excellente lisibilité ;
* boutons évidents ;
* feedback immédiat ;
* couleurs cohérentes ;
* interface chaleureuse mais pas enfantine.

Éviter :

* gradients excessifs ;
* glassmorphism partout ;
* dizaines de couleurs ;
* cartes dans des cartes dans des cartes ;
* animations inutiles ;
* design « IA générée ».

Le produit doit pouvoir convenir à un adolescent comme à un adulte.

---

# 42. FEEDBACK DES EXERCICES

Après une réponse :

bonne réponse :

* feedback immédiat ;
* animation courte ;
* pas de modal lourde.

mauvaise réponse :

* montrer correctement la réponse ;
* éventuellement une micro-explication ;
* continuer rapidement.

Ne pas humilier.

Ne pas afficher :

❌ ÉCHEC.

Préférer quelque chose de naturel et encourageant.

---

# 43. VITESSE

Les interactions locales doivent sembler instantanées.

Cible :

appui utilisateur
→ feedback visuel immédiat.

Les animations ne doivent pas ralentir l’utilisateur.

Précharger ce qui peut l’être.

Lazy load ce qui est lourd.

Utiliser skeleton uniquement lorsqu’il est réellement nécessaire.

Ne pas afficher de spinner si une transition optimiste est possible.

---

# 44. ROBUSTESSE

L’application doit fonctionner même si :

* une image ne charge pas ;
* l’API IA échoue ;
* le réseau est lent ;
* IndexedDB contient une donnée ancienne ;
* le JSON pédagogique change ;
* une conversation IA échoue.

Prévoir des fallbacks propres.

Une erreur IA ne doit jamais casser tout le parcours.

---

# 45. OFFLINE / LOCAL-FIRST

Les parties non IA doivent pouvoir continuer autant que raisonnablement possible sans connexion.

Notamment :

* consultation progression ;
* concepts déjà téléchargés ;
* exercices déjà générés ;
* navigation ;
* statistiques.

La conversation IA peut évidemment nécessiter Internet.

---

# 46. ORGANISATION DU CODE

Proposer une structure similaire à :

```text
src/
├── app/
│   ├── page.tsx
│   ├── onboarding/
│   ├── learn/
│   ├── language/
│   ├── mission/
│   └── settings/
│
├── components/
│   ├── ui/
│   ├── exercises/
│   ├── mission/
│   ├── learning/
│   └── navigation/
│
├── features/
│   ├── onboarding/
│   ├── learning/
│   ├── roadmap/
│   ├── exercises/
│   └── conversation/
│
├── core/
│   ├── learner/
│   ├── curriculum/
│   ├── game/
│   └── scoring/
│
├── ai/
│   ├── provider.ts
│   ├── prompts/
│   ├── exercises.ts
│   ├── conversation.ts
│   └── evaluation.ts
│
├── storage/
│   ├── db.ts
│   ├── repository.ts
│   ├── profiles.ts
│   ├── progress.ts
│   └── roadmap.ts
│
├── data/
│   ├── languages/
│   ├── curriculum/
│   └── concepts/
│
├── hooks/
├── types/
└── lib/
```

Adapter intelligemment si nécessaire.

Ne pas créer de dossiers artificiels sans utilité.

---

# 47. TYPES IMPORTANTS

Définir proprement au minimum :

```ts
type CEFRLevel =
  | "A1"
  | "A2"
  | "B1"
  | "B2"
  | "C1"
  | "C2";
```

ainsi que :

* Concept ;
* ConceptMastery ;
* LearningProfile ;
* LanguageAbility ;
* World ;
* Mission ;
* MissionProgress ;
* Exercise ;
* ExerciseAttempt ;
* Roadmap ;
* ConversationScenario ;
* ConversationMessage.

---

# 48. MOTEUR PÉDAGOGIQUE

Créer un moteur indépendant de React.

Il doit pouvoir répondre à des questions comme :

```ts
getNextMission(profile)
```

```ts
getRecommendedConcepts(profile)
```

```ts
updateConceptMastery(attempt)
```

```ts
estimateLevel(profile)
```

```ts
selectOldConceptsForReview(profile)
```

```ts
calculateMissionScore(mission)
```

Même si les premiers algorithmes sont simples, l’architecture doit permettre de les faire évoluer.

---

# 49. PREMIÈRE VERSION DE L’ALGORITHME

Ne pas chercher immédiatement un modèle mathématique parfait.

Pour la V1 :

* utiliser des scores entre 0 et 1 ;
* pondérer les performances ;
* augmenter progressivement la difficulté ;
* réintroduire les concepts fragiles ;
* favoriser les concepts jamais produits activement ;
* éviter de répéter trop rapidement exactement le même exercice.

Créer des constantes facilement modifiables.

Documenter les choix.

---

# 50. ESTIMATION INITIALE DU NIVEAU

Créer un mécanisme simple d’adaptive placement.

Par exemple :

Mission initiale simple.

Si performance > seuil élevé :

→ augmenter fortement difficulté.

Si performance moyenne :

→ légère augmentation.

Si performance faible :

→ rester ou réduire.

Après plusieurs missions, calculer :

* niveau probable ;
* confiance de l’estimation.

L’utilisateur doit pouvoir commencer à apprendre dès la première mission.

---

# 51. CONTENU INITIAL

Pour le prototype, ne pas essayer de créer 10 000 concepts.

Commencer avec une quantité suffisamment petite pour démontrer le moteur.

Par exemple :

* une langue réellement jouable : anglais ;
* éventuellement une deuxième langue démonstrative ;
* quelques dizaines de concepts ;
* 2 ou 3 mondes ;
* plusieurs missions.

Mais toute l’architecture doit supporter plusieurs langues.

---

# 52. MONDE DE DÉMONSTRATION

Créer par exemple :

🌱 Foundations

Mission 1:
Nice to Meet You

Mission 2:
My Everyday Life

Mission 3:
Food & Drinks

Puis :

🌆 City Life

Mission 4:
At the Café

Mission 5:
Finding Your Way

Ces missions doivent permettre de démontrer :

* nouveaux concepts ;
* rappel ancien ;
* contexte ;
* exercices ;
* score ;
* estimation de niveau ;
* immersion.

---

# 53. CONVERSATION IA V1

La conversation est uniquement textuelle.

Pas de :

* speech-to-text ;
* text-to-speech ;
* voix temps réel.

Mais concevoir les types de données de façon à pouvoir les ajouter plus tard.

L’interface conversation doit être mobile-first et extrêmement simple.

---

# 54. DONNÉES LOCALES

Utiliser IndexedDB pour conserver au minimum :

* langues actives ;
* profil par langue ;
* intérêts ;
* progression ;
* ConceptMastery ;
* missions terminées ;
* roadmap ;
* historique utile ;
* exercices générés/cachés.

Prévoir un système de version de schéma local.

---

# 55. EXPORT / RESET

Ajouter dans Settings pour le développement :

* reset progression ;
* éventuellement export JSON ;
* import JSON.

Cela facilitera énormément les tests du moteur adaptatif.

Ne pas mettre ces fonctionnalités au premier plan.

---

# 56. ACCESSIBILITÉ

Respecter :

* contrastes ;
* focus visible ;
* navigation clavier quand applicable ;
* aria labels ;
* tailles tactiles ;
* reduced motion.

Ne pas sacrifier l’accessibilité au design.

---

# 57. PERFORMANCE FRONTEND

Faire attention à :

* taille bundle ;
* rerenders inutiles ;
* images ;
* hydration ;
* chargement initial ;
* composants client inutiles.

Utiliser Server Components quand ils apportent quelque chose, mais ne pas compliquer l’architecture pour des données essentiellement locales.

Éviter de transformer toute l’application en architecture serveur inutile.

---

# 58. TESTS

Ajouter des tests au moins sur le cœur métier :

* calcul de mastery ;
* mise à jour après réponse ;
* sélection de concepts ;
* estimation niveau ;
* score de mission ;
* logique de répétition.

Le moteur pédagogique doit pouvoir être testé sans navigateur.

---

# 59. IMPORTANT : NE PAS SUR-ENGINEER

Ce projet est une V1.

Ne pas construire :

* microservices ;
* event sourcing ;
* DDD complexe ;
* système de plugins ;
* architecture distribuée ;
* abstraction excessive.

Créer seulement les abstractions qui protègent réellement les éléments susceptibles de changer :

* stockage ;
* IA ;
* images ;
* curriculum.

---

# 60. PREMIÈRE PHASE DE DÉVELOPPEMENT

Commence par inspecter le repository s’il existe.

Ensuite :

1. résume rapidement ce qui existe ;
2. propose une architecture concrète ;
3. identifie ce qui doit être créé/modifié ;
4. implémente le socle ;
5. ne t’arrête pas uniquement à une proposition théorique.

Je veux que tu écrives réellement le code.

---

# 61. ORDRE D’IMPLÉMENTATION

Priorité recommandée :

### Phase 1 — Fondation

* Next.js ;
* TypeScript ;
* design tokens ;
* navigation mobile ;
* structure du projet ;
* types métier.

### Phase 2 — Storage

* IndexedDB ;
* repository ;
* profil ;
* multi-langue ;
* persistence.

### Phase 3 — Onboarding

* choix langue ;
* intérêts ;
* création du LearningProfile ;
* lancement première mission.

### Phase 4 — Game Engine

* Concept ;
* ConceptMastery ;
* scoring ;
* progression ;
* difficulté.

### Phase 5 — Mission

Implémenter la boucle :

introduction
→ découverte
→ contexte
→ exercices
→ immersion mockée
→ bilan.

### Phase 6 — Roadmap

* Monde ;
* Mission ;
* progression ;
* adaptation légère.

### Phase 7 — IA

Créer AIProvider.

Au départ permettre un `MockAIProvider` afin que toute l’application fonctionne sans clé.

Puis brancher un vrai provider.

### Phase 8 — Conversation

* conversation textuelle ;
* objectifs ;
* targetConcepts ;
* knownConcepts ;
* weakConcepts.

---

# 62. MOCK FIRST

Le jeu doit être entièrement utilisable avec :

`MockAIProvider`

Cela est très important.

Je dois pouvoir travailler sur :

* gameplay ;
* design ;
* progression ;
* animations ;
* moteur ;

sans consommer de tokens IA.

Le provider réel doit pouvoir être activé via configuration.

---

# 63. ÉCRAN PRINCIPAL À CONSTRUIRE

Créer un prototype fonctionnel de ce flow :

Premier lancement

↓

Choix de la langue

↓

Centres d’intérêt

↓

Mission 1

↓

Concept 1

↓

Contexte

↓

Exercice

↓

Exercice

↓

Mini conversation

↓

Bilan

↓

Mise à jour du niveau estimé

↓

Home

↓

Continuer Mission 2

---

# 64. UI MOBILE

Pour tous les écrans importants, vérifier particulièrement une largeur autour de :

375px à 430px.

Éviter les composants qui nécessitent horizontal scroll.

Bottom navigation uniquement si elle est réellement nécessaire.

Pour le MVP, une structure très légère peut suffire :

Home
Progress
Settings

Mais même cela doit être évalué selon l’utilité.

L’action `Continuer` doit rester dominante.

---

# 65. PHILOSOPHIE DU PRODUIT

Chaque décision doit être évaluée avec cette question :

> Est-ce que cela aide l’utilisateur à apprendre plus facilement sans rendre l’expérience plus lourde ?

Si non, simplifier.

Le produit doit cacher une grande complexité pédagogique derrière une interface simple.

---

# 66. CRITÈRES DE RÉUSSITE DE LA PREMIÈRE VERSION

La V1 est réussie si quelqu’un peut :

1. ouvrir Bibata ;
2. choisir l’anglais ;
3. sélectionner ses intérêts ;
4. commencer sans test ;
5. apprendre quelques concepts ;
6. les voir en contexte ;
7. faire plusieurs types d’exercices ;
8. participer à une situation simulée ;
9. recevoir un score ;
10. voir son nombre de concepts appris ;
11. voir son niveau estimé ;
12. continuer la mission suivante ;
13. fermer l’application ;
14. revenir plus tard ;
15. retrouver toute sa progression.

---

# 67. CE QUI DOIT ÊTRE INVISIBLE POUR LE JOUEUR

Le joueur ne doit pas être confronté directement à des termes comme :

* ConceptMastery ;
* SRS ;
* confidence score ;
* learner model ;
* curriculum engine ;
* prompt ;
* LLM ;
* embedding ;
* adaptive algorithm.

Il voit simplement :

> A2

> 327 concepts

> Continuer

> Mission terminée

> +8 concepts

Toute l’intelligence reste derrière.

---

# 68. TON DE L’APPLICATION

Utiliser un ton :

* simple ;
* humain ;
* positif ;
* direct ;
* adulte ;
* jamais infantilisant.

Éviter les longs paragraphes dans l’interface.

Utiliser des phrases courtes.

---

# 69. DONNÉES DE DÉMONSTRATION

Créer suffisamment de données réalistes pour que le prototype donne l’impression d’un vrai produit.

Ne pas utiliser partout :

`Lorem ipsum`

ou :

`Test mission 1`.

Utiliser de vrais concepts anglais et de vrais scénarios.

---

# 70. QUALITÉ DU CODE

Avant de considérer une étape terminée :

* TypeScript doit compiler ;
* lint doit passer ;
* éviter les `any` inutiles ;
* supprimer le code mort ;
* gérer loading/error/empty states ;
* vérifier mobile ;
* vérifier persistence ;
* vérifier refresh navigateur.

---

# 71. DOCUMENTATION

Créer un README clair contenant :

* vision du projet ;
* stack ;
* installation ;
* démarrage ;
* architecture ;
* fonctionnement du mock AI ;
* stockage local ;
* structure pédagogique ;
* comment ajouter une langue ;
* comment ajouter un monde ;
* comment ajouter une mission ;
* comment ajouter un type d’exercice ;
* comment brancher un AIProvider.

---

# 72. IMPORTANT POUR TON TRAVAIL

Ne réponds pas uniquement avec une énorme architecture abstraite.

Après avoir analysé ces exigences :

1. inspecte le repository ;
2. établis un petit plan d’exécution ;
3. commence immédiatement l’implémentation ;
4. travaille par étapes cohérentes ;
5. exécute les tests/lint/build régulièrement ;
6. corrige les erreurs rencontrées ;
7. privilégie toujours une V1 réellement jouable.

Si certains détails sont encore indéterminés, choisis la solution :

* la plus simple ;
* la plus facilement modifiable ;
* la plus robuste ;
* la plus adaptée à une V1.

Ne bloque pas le développement pour des détails mineurs.

---

# 73. RÉSUMÉ DU CONCEPT À GARDER EN TÊTE

Bibata est une application mobile-first d’apprentissage adaptatif des langues.

L’utilisateur peut apprendre plusieurs langues.

Chaque langue possède son propre niveau estimé et sa propre progression.

Il ne passe pas de test initial classique.

Les premières missions apprennent et évaluent simultanément.

Le parcours est organisé en :

MONDES
→ MISSIONS

Chaque mission suit approximativement :

DÉCOUVRIR
→ VOIR EN CONTEXTE
→ RÉPÉTER
→ PRATIQUER
→ UTILISER EN SITUATION
→ BILAN

L’application suit individuellement la maîtrise de chaque concept.

Les concepts mal maîtrisés ne bloquent pas l’utilisateur.

Ils réapparaissent naturellement plus tard.

Le parcours est adaptatif mais stable.

L’IA personnalise et enrichit l’expérience sans contrôler seule la pédagogie.

Le jeu doit sembler :

**simple devant, intelligent derrière.**

La priorité absolue est :

**mobile-first + UX + fluidité + vitesse + robustesse.**

Commence maintenant par inspecter le projet puis construis la première boucle jouable de Bibata.
