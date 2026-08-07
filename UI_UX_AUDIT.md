# Audit UI/UX — Bibata

## Diagnostic initial

- Identité visuelle mémorable, palette cohérente et excellent traitement mobile.
- Onboarding incomplet : le niveau, pourtant déterminant pour l’IA, n’était demandé qu’après coup dans les réglages.
- Plusieurs informations étaient artificielles ou ambiguës : série de jours, objectif quotidien et progression vers A2.
- Un bouton « plus d’options » n’avait aucune action et l’ajout de langue pouvait ramener vers un parcours indisponible.
- Quitter une mission en cours ne demandait aucune confirmation.
- La conversation ne revenait pas automatiquement au dernier message.
- Manifest présent, mais sans icônes adaptées, service worker, état hors ligne ou parcours d’installation.
- Les petits textes de 9–10 px et certains contrastes secondaires limitaient la lisibilité.
- Sur grand écran, l’application restait un simple écran mobile centré au lieu d’utiliser l’espace disponible.

## Améliorations réalisées

- Onboarding en trois étapes : langue, niveau CECR, centres d’intérêt.
- Niveau A1–C2 immédiatement appliqué au profil et au modèle Mammouth correspondant.
- Données réelles pour les missions terminées et la progression du monde.
- Suppression des actions sans effet et simplification des libellés.
- Installation PWA, icônes dédiées, cache de l’interface et signalement clair du mode hors ligne.
- Confirmation avant abandon ou réinitialisation, notifications non bloquantes et retours d’action explicites.
- Navigation accessible, cibles tactiles agrandies, progression sémantique et meilleure lisibilité.
- Conversation avec défilement automatique et états d’attente/erreur plus compréhensibles.
- Mise en page responsive en grille sur ordinateur, tout en conservant l’expérience native sur mobile.

## Principes retenus

1. Une action visible doit toujours produire un résultat clair.
2. Ne jamais afficher une progression qui ne provient pas des données réelles.
3. Garder une seule action principale par écran.
4. Préserver le travail de l’utilisateur avant toute sortie ou réinitialisation.
5. L’interface reste utilisable hors ligne ; les fonctions IA expliquent honnêtement qu’une connexion est requise.
