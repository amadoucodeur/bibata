# Architecture des données Bibata

Bibata utilise une architecture **local-first** : l’expérience reste immédiate grâce à IndexedDB, puis les changements sont synchronisés avec PostgreSQL/Supabase lorsque l’utilisateur est connecté avec Google. La base distante devient la sauvegarde multi-appareil et la source de vérité pour la facturation.

## Modèle

| Domaine | Table | Rôle |
| --- | --- | --- |
| Identité | `auth.users` | Identité Google gérée par Supabase Auth |
| Identité | `user_profiles` | Nom, avatar, langue d’interface et fuseau |
| Préférences | `user_settings` | Langue active et préférences produit |
| Apprentissage | `learning_profiles` | Niveau CECR, intérêts, capacités et fil pédagogique par langue |
| Apprentissage | `mission_progress` | État, score et fin des missions |
| Apprentissage | `concept_mastery` | Maîtrise et date de révision espacée par concept |
| Facturation | `billing_accounts` | Compte individuel, formule et numéro Mobile Money |
| Facturation | `billing_usage_events` | Preuve idempotente qu’un mois est actif |
| Facturation | `billing_invoices` | Une facture de 1 000 XOF par compte et par mois actif |
| Paiement | `payment_transactions` | Tentatives PayDunya et références de rapprochement |
| Audit | `payment_webhook_events` | Notifications PayDunya dédupliquées sans conserver le payload sensible |

## Choix structurants

- Les données interrogées souvent sont relationnelles et indexées. Le JSONB est réservé aux objets pédagogiques susceptibles d’évoluer (`ability`, `learning_plan`, `attempts`).
- Chaque donnée d’apprentissage est rattachée à `auth.users` par une chaîne de clés étrangères avec suppression en cascade.
- Une contrainte unique empêche les doubles factures et les doubles événements d’usage. Les références PayDunya et les webhooks sont également idempotents.
- Le navigateur ne reçoit jamais la clé Supabase secrète ni les clés PayDunya. Les écritures distantes passent par les Route Handlers Bibata, après validation de la session et du payload.
- Les utilisateurs authentifiés ont seulement un accès SQL en lecture à leurs propres lignes. Les écritures utilisent exclusivement le serveur, avec RLS activée sur toutes les tables.
- La synchronisation est différée de 1,5 seconde et n’envoie que les progressions et maîtrises modifiées. Un échec réseau ne bloque pas l’apprentissage local.

## Cycle des données

1. L’utilisateur apprend sans attendre le réseau ; IndexedDB est mis à jour immédiatement.
2. Après connexion Google, Bibata fusionne la copie locale et la copie Supabase sans perdre une mission terminée.
3. Les changements suivants sont envoyés par delta à `/api/sync`.
4. Une mission terminée crée au maximum un événement d’usage pour le mois.
5. Au mois suivant, une facture unique de 1 000 XOF est matérialisée si le mois précédent a été actif.
6. PayDunya ouvre le paiement. Seule la vérification serveur du token, du statut et du montant peut marquer la facture payée.

## Installation

La base entière est installée en une transaction par :

```text
supabase/migrations/202608100001_bibata_platform.sql
```

Exécuter ce fichier dans le SQL Editor du **même projet Supabase que celui déclaré dans `.env`**. La transaction évite une installation partielle : en cas d’erreur, aucune table de la migration n’est validée.

## Exploitation recommandée

- Sauvegardes automatiques Supabase et restauration testée avant le lancement commercial.
- Purge périodique des `payment_webhook_events` anciens après la durée d’audit choisie ; ne jamais purger les factures ou transactions exigées par la comptabilité.
- Alertes sur les IPN en échec, les factures bloquées en `pending` et le taux d’erreur de `/api/sync`.
- Toute évolution de schéma passe par une nouvelle migration versionnée ; ne pas modifier la migration initiale après son application en production.
