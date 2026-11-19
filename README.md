# HOSPIFLOW — Correctifs Étape 1 (Scripts Node.js)

Ce paquet contient les fichiers corrigés de l'**Étape 1** (sécurité, RBAC/Policies, Form Requests et logique métier) ainsi que deux scripts **Node.js** pour appliquer et vérifier les correctifs automatiquement depuis la racine du dépôt.

## Scripts Node.js inclus
- `scripts/apply-step1.js` :
  - `node scripts/apply-step1.js --dry-run` : prévisualise les fichiers qui seront écrits.
  - `node scripts/apply-step1.js` : applique tous les fichiers dans `./api/...`.
  - `node scripts/apply-step1.js --verify` : applique les fichiers puis lance `pint`, `phpstan` et `pest` dans `./api`.
- `scripts/audit-step1.js` :
  - `node scripts/audit-step1.js` : vérifie la présence des correctifs clés dans `./api`.
