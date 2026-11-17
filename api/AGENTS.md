# HOSPIFLOW — Conventions projet

> Ce fichier remplace le bootstrap Laravel Boost (Vague 1).

## Stack

- Laravel 13 (API REST), PHP 8.3+, Sanctum (auth), Spatie Permissions (RBAC).
- Base : SQLite en dev, PostgreSQL en prod.
- Frontend SPA séparé (hors de api/).

## Architecture

- Multi-tenant par établissement : toute requête métier scopée via currentFacility().
- Un contrôleur = un module (M00→M10).
- Permissions : patients., appointments., consultations., lab., pharmacy., billing., reports., facilities.

## Conventions

- Messages utilisateur en français, code en anglais.
- Validation dans `$request->validate([...])` (Form Requests en Vague 2).
- Toujours répondre en JSON. Erreurs via `abort(4xx, 'message FR')`.
- Pas d'appel `request()` global dans les closures de transaction.

## Base de données

- Portabilité SQLite/PostgreSQL obligatoire : pas de ilike, to_char, extract.
- Utiliser LOWER(col) LIKE LOWER(?) et calculer les dérivés en PHP.
- Index sur facility_id, patient_id, status, scheduled_at.

## Sécurité

- Jamais de `exists:users,email` ni de message permettant d'énumérer les comptes.
- Routes protégées par auth:sanctum (sauf /login).
- Chaque contrôleur vérifie currentFacility()->is_active.

## Tests

- php artisan test avant chaque commit.
- Chaque contrôleur : Feature test happy path + 403 + 422.
