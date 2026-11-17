# HOSPIFLOW — Contexte & Vision Projet

> **Dernière mise à jour** : 2026-11-17
> **État du code** : Vague 1 & 2 terminées (MVP sécurisé, testé, CI verte sur GitHub)
> **Vision Produit** : HealthTech professionnelle, SaaS multi-établissements, Cloud-first.
> **Repo** : https://github.com/Maxlechampion/hospiflow

---

## 1. 🎯 Vision & Décisions Stratégiques (MVP)

Pour faire de HOSPIFLOW une solution HealthTech convoitée, nous appliquons les règles suivantes :
- **Logiciel** : 100% Open Source et gratuit (Laravel, Vue 3, PostgreSQL).
- **Hébergement** : Gratuit en développement (local/Docker), professionnel (payant) uniquement pour le pilote avec de vrais patients.
- **Architecture** : Cloud-first, sans serveur local obligatoire. Mode hors ligne individuel par appareil (PWA).
- **Identification Patient** : MPI central HOSPIFLOW (identité réseau unique) + conservation des identifiants locaux de chaque établissement.
- **Dossier Médical** : Vue longitudinale consolidée, mais les données sources restent hébergées et gérées par chaque établissement (traçabilité de la provenance).
- **HOSPIFLOW SHARE** : Partage médical limité et progressif pour le MVP.
- **Périmètre MVP** : Établissements, Utilisateurs, Rôles, Patients (MPI), Admissions, Dossier médical (DME), Consultations, Rendez-vous, Lits/Hospitalisations, Dashboard, HOSPIFLOW SHARE (v1), Synchronisation.

*(Modules reportés : Pharmacie, Laboratoire, Finances, RH, IA. Le code actuel les couvre déjà en partie, mais l'accent produit reste sur le cœur clinique).*

---

## 2. 🛠 Stack Technique

- **Backend** : Laravel 13, PHP 8.3+ (API REST)
- **Frontend** : Vue.js 3 + TypeScript (PWA, stockage hors ligne avec IndexedDB / Dexie.js)
- **Base de données** : PostgreSQL (prod) / SQLite (dev & tests)
- **Auth** : Laravel Sanctum
- **RBAC** : Spatie Laravel Permission
- **Audit** : Spatie Activity Log
- **Tests** : Pest PHP 4
- **Formatage** : Laravel Pint
- **Analyse statique** : Larastan niveau 5 (PHPStan 2.x)
- **CI/CD** : GitHub Actions
- **Environnement** : Docker (à configurer pour la prod)
- **Maquettes/Conception** : Penpot, OpenAPI/Swagger

---

## 3. 🔒 Sécurité & Conformité (Intégrées dès le MVP)

La sécurité fait partie de l'architecture initiale (réalisée dans les Vagues 1 & 2) :
- **Isolation stricte** : Chaque requête métier est scopée par `facility_id` (Multi-tenant via Middleware `EnsureFacilityIsActive` et Policies Laravel).
- **Authentification** : Tokens Sanctum, rate limiting (`throttle:5,1` sur `/login`), anti-énumération d'e-mails.
- **Autorisation** : 6 Policies Laravel + Spatie.
- **Journalisation** : Audit log automatique sur les 5 entités sensibles (Patient, Consultation, Invoice, DrugLot, Appointment) avec `tapActivity()` pour tracer la `facility_id`.
- **Données** : Format d'erreur JSON uniforme, respect de la portabilité SQL (SQLite/PostgreSQL).

---

## 4. 🏗 Architecture du Code & Modules

### Multi-tenant (Cœur du système)
1. Middleware `EnsureFacilityIsActive` : bloque si l'utilisateur n'a pas d'établissement actif.
2. Trait `ResolvesFacility` : injecte `$this->facility($request)` dans les contrôleurs.
3. Policies : vérifient que `$user->current_facility_id === $model->facility_id`.

### Modules métier implémentés (M00 → M10)
| Module | Contrôleur | Statut |
|---|---|---|
| M00 — Auth | `AuthController` | ✅ |
| M01 — Établissements | `FacilityController` | ✅ |
| M02 — Patients (MPI) | `PatientController` | ✅ |
| M03 — Rendez-vous | `AppointmentController` | ✅ |
| M04 — Consultations | `ConsultationController` | ✅ |
| M05 — Laboratoire | `LabRequestController` | ✅ |
| M06 — Pharmacie | `PharmacyController` | ✅ |
| M07 — Facturation | `InvoiceController` | ✅ |
| M08 — Rapports | `ReportController` | ✅ |
| M09 — Audit | `AuditLogController` | ✅ |

---

## 5. 📊 État d'avancement & Tests

| Vague | Statut | Contenu |
|---|---|---|
| **Vague 1** | ✅ | Correctifs critiques (SQL portable, bugs `array_filter`, sécurité email) |
| **Lot A** | ✅ | Middlewares, 7 Form Requests, Rate limiting, JSON uniformes |
| **Lot B** | ✅ | Audit log (Spatie Activity Log) + intégration multi-tenant |
| **Lot B-bis** | ✅ | 6 Policies Laravel (Patient, Appointment, Consultation, Invoice, LabRequest, DrugLot) |
| **Lot B-ter** | ✅ | Form Requests migrés vers les Policies |
| **Lot C1** | ✅ | 40 tests Pest / 106 assertions (Auth, Patient, RDV, Facture, Audit, Policies) |
| **Lot C3** | ✅ | CI GitHub Actions + Larastan niveau 5 (0 erreur) |
| **Vague 3** | ⏳ | **À faire : Fonctionnel métier (Prescriptions, Tarification, Catalogue labo)** |

---

## 6. 🎯 Prochaine étape : Vague 3 (Fonctionnel Métier)

Les priorités pour la suite du développement :
1. **Prescriptions structurées** : tables `prescriptions` + `prescription_items` liés à `Drug`.
2. **Tarification médicaments** : ajouter `unit_price` sur `Drug` et lier la dispensation à une facture (`InvoiceItem`).
3. **Catalogue d'analyses labo** : tables `lab_panels` + `lab_panel_items`.
4. **Admissions & Lits** : tables `admissions` (lié au patient et à la facility).

---

## 7. 📐 Conventions de Développement

- **Code** : anglais (variables, méthodes, colonnes).
- **Messages utilisateur** : français.
- **Validation** : Form Requests (pas de `$request->validate()` dans les contrôleurs).
- **Autorisation** : Policies Laravel (pas de `$user->can('permission')` direct).
- **Portabilité SQL** : compatible SQLite **et** PostgreSQL (pas de `ilike`, `to_char`, `extract` — utiliser `LOWER()` et calculer en PHP).
- **Erreurs** : format uniforme `{error: {code, message, fields?}}`.
- **Tests** : Pest, DB `:memory:`, `RefreshDatabase`.
- **Style** : `./vendor/bin/pint` avant chaque commit.

---

## 8. 🔗 Fichiers clés & Commandes

**Fichiers critiques :**
- `api/routes/api.php` (Routes)
- `api/bootstrap/app.php` (Middlewares + JSON handler)
- `api/app/Http/Controllers/Concerns/ResolvesFacility.php` (Trait facility)
- `api/app/Http/Middleware/EnsureFacilityIsActive.php`
- `api/tests/Pest.php` (Config tests)
- `api/phpstan.neon` (Config Larastan)
- `.github/workflows/ci.yml` (Tests + Lint)
- `.github/workflows/static-analysis.yml` (Larastan)

**Commandes utiles :**
```bash
# Tests
cd api && ./vendor/bin/pest --colors=never

# Formatage
cd api && ./vendor/bin/pint

# Analyse statique
cd api && ./vendor/bin/phpstan analyse --memory-limit=2G

# CI locale (tout d'un coup)
cd api && ./vendor/bin/pint --test && ./vendor/bin/phpstan analyse && ./vendor/bin/pest