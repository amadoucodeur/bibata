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
- IndexedDB local-first et synchronisation Supabase après connexion Google
- Mammouth AI pour les conversations et générations
- Tests du moteur avec le runner natif de Bun

## Architecture

```text
app/                    routes, métadonnées et styles
ai/                     contrat AIProvider et intégration Mammouth
core/                   moteur pédagogique indépendant de React
data/                   curriculum et contenu de démonstration
features/               expérience interactive Bibata
storage/                repository IndexedDB et migrations légères
billing/                règles postpayées et intégrations serveur
supabase/migrations/    schéma PostgreSQL complet, contraintes et RLS
types/                  modèles métier partagés
```

La vue React ne connaît pas IndexedDB directement. Elle utilise `StorageRepository` et synchronise en arrière-plan les seules données modifiées vers Supabase après connexion Google. Le moteur pédagogique reste pur et testable sans navigateur. Le modèle complet est décrit dans [`DATABASE.md`](./DATABASE.md).

## Stockage local

`IndexedDBStorageRepository` conserve une seule enveloppe versionnée : profils par langue, maîtrise des concepts, progression des missions et langue active. Un repli `localStorage` protège le prototype si IndexedDB est indisponible. Les réglages permettent l’export, l’import et la remise à zéro.

## IA Mammouth

Le navigateur appelle uniquement `/api/ai` : la clé `MAMMOUTH_API_KEY` reste côté serveur. `MammouthAIProvider` gère les tours de conversation réellement utilisés par cette première version. Le niveau CECR choisi dans les réglages, de A1 à C2, adapte le vocabulaire, la nuance, la longueur, le budget de réponse et le modèle utilisé. La route valide les requêtes et les réponses, puis distingue les erreurs de configuration, de quota, de délai et de service. En cas d’échec, l’interface conserve l’échange et permet de réessayer sans générer de réponse fictive.

Copier `.env.example` vers `.env.local`, puis renseigner la clé. Par défaut, A1–A2 utilise `mistral-small-2603`, B1–B2 utilise `mistral-medium-3.1` et C1–C2 utilise `glm-5.2`. Les variables `MAMMOUTH_MODEL_BEGINNER`, `MAMMOUTH_MODEL_INTERMEDIATE` et `MAMMOUTH_MODEL_ADVANCED` permettent de remplacer chaque palier sans modifier le code.

## Étendre le contenu

- Ajouter une langue : compléter `languages`, puis fournir son curriculum dans `data/`.
- Ajouter un monde : ajouter un `World` à `roadmap` et référencer ses missions.
- Ajouter une mission : créer ses concepts, exercices déterministes et scénario de conversation.
- Ajouter un exercice : étendre `ExerciseType`, son payload typé, puis créer son composant de rendu.

Le contenu de démonstration rend l’anglais jouable sur deux missions : **Nice to Meet You** et **My Everyday Life**. Les autres langues et mondes sont annoncés comme futurs contenus, sans simuler une disponibilité qui n’existe pas encore.

## Facturation individuelle postpayée

Une mission terminée rend le mois actif. Bibata crée au début du mois suivant une seule facture individuelle de **1 000 FCFA**, payable sous sept jours, sans prélèvement automatique. Le paiement est ouvert chez PayDunya et n’est validé qu’après vérification serveur du hash, du montant et du statut.

Pour activer le module :

1. Exécuter l’unique migration `supabase/migrations/202608100001_bibata_platform.sql` dans le projet Supabase. Elle installe ensemble l’identité, l’apprentissage, la progression, la facturation, les paiements et leurs politiques RLS.
2. Renseigner `SUPABASE_PROJECT_ID`, `SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_SECRET_KEY`, puis activer Google dans Supabase Auth. Ajouter `http://localhost:3000/auth/callback` et l’URL publique équivalente à la liste des redirections autorisées.
3. Renseigner `PAYDUNYA_PRINCIPAL_KEY`, `PAYDUNYA_PUBLIC_KEY`, `PAYDUNYA_PRIVATE_KEY`, `PAYDUNYA_TOKEN` et `APP_BASE_URL`. `PAYDUNYA_MODE=test` utilise le sandbox ; `PAYDUNYA_MODE=production` utilise les paiements réels. Hors développement local, `APP_BASE_URL` doit être une origine HTTPS publique afin que PayDunya puisse appeler `/payment-verif`.

Les clés de service et de paiement ne doivent jamais être préfixées par `NEXT_PUBLIC_`. Sans ces variables, l’interface affiche un état de configuration explicite et ne simule aucune facture ni aucun paiement.
