# Bibata

Bibata est une application mobile-first d’apprentissage des langues par missions courtes. Le prototype apprend et évalue en même temps : découverte, contexte, exercices instantanés, conversation guidée, puis bilan.

## Démarrer

```bash
bun install
bun dev
```

Ouvrir ensuite `http://localhost:3000`.

Vérifications :

```bash
bun test
bun run lint
bun run build
```

## Stack

- Next.js 16 avec App Router, React 19 et TypeScript strict
- Tailwind CSS 4 et styles globaux pour l’identité visuelle
- IndexedDB pour les profils, progressions, maîtrises et résultats
- Mammouth AI pour les conversations et générations, avec `MockAIProvider` en repli
- Tests du moteur avec le runner natif de Bun

## Architecture

```text
app/                    routes, métadonnées et styles
ai/                     contrat AIProvider et mock local
core/                   moteur pédagogique indépendant de React
data/                   curriculum et contenu de démonstration
features/               expérience interactive Bibata
storage/                repository IndexedDB et migrations légères
types/                  modèles métier partagés
```

La vue React ne connaît pas IndexedDB directement. Elle utilise `StorageRepository`, ce qui permettra de synchroniser plus tard avec un backend sans réécrire le jeu. Le moteur pédagogique reste pur et testable sans navigateur.

## Stockage local

`IndexedDBStorageRepository` conserve une seule enveloppe versionnée : profils par langue, maîtrise des concepts, progression des missions et langue active. Un repli `localStorage` protège le prototype si IndexedDB est indisponible. Les réglages permettent l’export, l’import et la remise à zéro.

## IA Mammouth et mode mock

Le navigateur appelle uniquement `/api/ai` : la clé `MAMMOUTH_API_KEY` reste côté serveur. `MammouthAIProvider` couvre les exercices, le contexte, l’évaluation libre, les tours de conversation et les missions personnalisées. `MockAIProvider` prend automatiquement le relais si le réseau ou Mammouth est indisponible, afin de ne jamais bloquer une mission.

Copier `.env.example` vers `.env.local`, puis renseigner la clé. `MAMMOUTH_MODEL` est facultatif et utilise `mistral-small-2603` par défaut pour privilégier des réponses courtes et rapides.

## Étendre le contenu

- Ajouter une langue : compléter `languages`, puis fournir son curriculum dans `data/`.
- Ajouter un monde : ajouter un `World` à `roadmap` et référencer ses missions.
- Ajouter une mission : créer ses concepts, exercices déterministes et scénario de conversation.
- Ajouter un exercice : étendre `ExerciseType`, son payload typé, puis créer son composant de rendu.

Le contenu de démonstration rend l’anglais jouable sur deux missions : **Nice to Meet You** et **My Everyday Life**. Les autres langues et mondes sont annoncés comme futurs contenus, sans simuler une disponibilité qui n’existe pas encore.
