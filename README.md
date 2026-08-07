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
- `MockAIProvider` pour une expérience complète sans clé ni appel réseau
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

## Mock IA

`MockAIProvider` implémente le même contrat qu’un futur fournisseur distant : exercices, contexte, évaluation libre, tour de conversation et mission personnalisée. La boucle normale de jeu reste locale. Pour brancher un vrai fournisseur, créer une nouvelle implémentation de `AIProvider`, puis remplacer l’instance exportée dans `ai/provider.ts`. Les secrets devront alors être déplacés dans une route serveur `/api/ai`.

## Étendre le contenu

- Ajouter une langue : compléter `languages`, puis fournir son curriculum dans `data/`.
- Ajouter un monde : ajouter un `World` à `roadmap` et référencer ses missions.
- Ajouter une mission : créer ses concepts, exercices déterministes et scénario de conversation.
- Ajouter un exercice : étendre `ExerciseType`, son payload typé, puis créer son composant de rendu.

Le contenu de démonstration rend l’anglais jouable sur deux missions : **Nice to Meet You** et **My Everyday Life**. Les autres langues et mondes sont annoncés comme futurs contenus, sans simuler une disponibilité qui n’existe pas encore.
