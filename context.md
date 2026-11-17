# HOSPIFLOW — Contexte projet

> **Dernière mise à jour** : 2026-11-17T16:36:13.575Z
> **Généré automatiquement** par `export-project.mjs`

## 📊 Statistiques

| Catégorie | Nombre |
|---|---|
| Dossiers | 51 |
| Fichiers totaux | 214 |
| Lignes de code (total) | ~24 117 |
| Taille totale | 854.2 Ko |
| Contrôleurs | 10 |
| Modèles | 14 |
| Form Requests | 7 |
| Policies | 6 |
| Middlewares | 2 |
| Factories | 9 |
| Migrations | 16 |
| Seeders | 8 |
| Fichiers de tests | 9 |
| Workflows CI | 0 |
| Fichiers de config | 12 |

## 🛠 Stack technique

- **Backend** : Laravel 13, PHP 8.3+
- **Auth** : Laravel Sanctum (tokens)
- **RBAC** : Spatie Permissions
- **Audit** : Spatie Activity Log
- **Tests** : Pest PHP 4
- **Formatage** : Laravel Pint
- **Analyse statique** : Larastan niveau 5 (PHPStan 2.x)
- **Base de données** : SQLite (dev) / PostgreSQL (prod)
- **CI** : GitHub Actions

## 🏗 Architecture

### Modules métier (M00 → M10)

| Module | Description | Contrôleur |
|---|---|---|
| M00 | Authentification | `AuthController` |
| M01 | Établissements | `FacilityController` |
| M02 | Patients (MPI) | `PatientController` |
| M03 | Rendez-vous | `AppointmentController` |
| M04 | Consultations | `ConsultationController` |
| M05 | Laboratoire | `LabRequestController` |
| M06 | Pharmacie | `PharmacyController` |
| M07 | Facturation | `InvoiceController` |
| M08 | Rapports | `ReportController` |
| M09 | Audit | `AuditLogController` |

### Multi-tenant

Toute requête métier est scopée par `facility` (établissement actif) :
1. Middleware `EnsureFacilityIsActive` vérifie que l'utilisateur a une facility active
2. Trait `ResolvesFacility` fournit `$this->facility($request)`
3. Policies vérifient `$user->current_facility_id === $model->facility_id`

## 🎯 Contrôleurs

| Contrôleur | Lignes | Rôle |
|---|---|---|
| `AppointmentController.php` | 219 | — |
| `AuditLogController.php` | 91 | — |
| `AuthController.php` | 70 | — |
| `ConsultationController.php` | 163 | — |
| `FacilityController.php` | 117 | — |
| `InvoiceController.php` | 253 | — |
| `LabRequestController.php` | 211 | — |
| `PatientController.php` | 185 | — |
| `PharmacyController.php` | 294 | — |
| `ReportController.php` | 224 | — |

## 🗄 Modèles Eloquent

| Modèle | Lignes | Traits |
|---|---|---|
| `Appointment.php` | 70 | HasFactory, LogsActivity |
| `Consultation.php` | 74 | HasFactory, LogsActivity |
| `Dispensation.php` | 40 | — |
| `Drug.php` | 30 | HasFactory |
| `DrugLot.php` | 54 | HasFactory, LogsActivity |
| `Facility.php` | 45 | HasFactory |
| `Invoice.php` | 72 | HasFactory, LogsActivity |
| `InvoiceItem.php` | 23 | — |
| `LabRequest.php` | 52 | HasFactory |
| `LabResult.php` | 32 | — |
| `MasterPatientIndex.php` | 47 | HasFactory |
| `Patient.php` | 66 | HasFactory, LogsActivity, SoftDeletes |
| `Payment.php` | 27 | — |
| `User.php` | 58 | HasApiTokens, HasFactory, HasRoles, Notifiable |

## 📝 Form Requests

| Request | Lignes |
|---|---|
| `StoreAppointmentRequest.php` | 35 |
| `LoginRequest.php` | 31 |
| `PayInvoiceRequest.php` | 34 |
| `StoreInvoiceRequest.php` | 38 |
| `StorePatientRequest.php` | 38 |
| `UpdatePatientRequest.php` | 32 |
| `DispenseRequest.php` | 35 |

## 🔐 Policies (autorisation)

| Policy | Lignes |
|---|---|
| `AppointmentPolicy.php` | 38 |
| `ConsultationPolicy.php` | 32 |
| `DrugLotPolicy.php` | 39 |
| `InvoicePolicy.php` | 48 |
| `LabRequestPolicy.php` | 40 |
| `PatientPolicy.php` | 44 |

## 🛡 Middlewares

| Middleware | Lignes |
|---|---|
| `EnsureFacilityIsActive.php` | 60 |
| `ResolveFacility.php` | 28 |

## 🧪 Tests (Pest)

| Fichier | Lignes |
|---|---|
| `AppointmentTest.php` | 64 |
| `AuditLogTest.php` | 96 |
| `AuthTest.php` | 92 |
| `ExampleTest.php` | 20 |
| `InvoiceTest.php` | 75 |
| `PatientTest.php` | 104 |
| `PolicyTest.php` | 141 |
| `ExampleTest.php` | 17 |
| `PatientLikeHelperTest.php` | 25 |

## 📦 Migrations

Total : 16 migrations

## 🌱 Seeders

- `BillingPermissionsSeeder.php`
- `ConsultationsPermissionsSeeder.php`
- `DatabaseSeeder.php`
- `FacilitiesSeeder.php`
- `LabPermissionsSeeder.php`
- `PatientsSeeder.php`
- `PharmacyPermissionsSeeder.php`
- `RolesAndPermissionsSeeder.php`

## 📐 Conventions

- **Code** : anglais (variables, méthodes, colonnes)
- **Messages utilisateur** : français
- **Validation** : Form Requests (pas de `$request->validate()` dans les contrôleurs)
- **Autorisation** : Policies Laravel (pas de `$user->can('permission')` direct)
- **Portabilité SQL** : compatible SQLite **et** PostgreSQL (pas de `ilike`, `to_char`, `extract`)
- **Erreurs** : format uniforme `{error: {code, message, fields?}}`
- **Tests** : Pest, DB `:memory:`, `RefreshDatabase`

## 🌐 API (43 routes)

### Public

- `POST /api/auth/login` — `throttle:5,1`

### Authentifié (Sanctum)

- `GET  /api/auth/me`
- `POST /api/auth/logout`
- `GET  /api/facilities`
- `POST /api/facilities`
- `PATCH /api/facilities/{id}`
- `POST /api/facilities/{id}/switch`
- `POST /api/facilities/{id}/users`

### Métier (facility active requise)

- **Patients** : GET/POST `/api/patients`, GET `/search`, GET/PATCH `/{id}`
- **Rendez-vous** : GET/POST `/api/appointments`, GET `/practitioners`, GET/PATCH `/{id}`
- **Consultations** : GET/POST `/api/consultations`, GET/PATCH `/{id}`
- **Labo** : GET/POST `/api/lab-requests`, GET/PATCH `/{id}`, POST `/{id}/result`
- **Pharmacie** : GET/POST `/api/pharmacy/drugs`, GET/POST `/stock`, GET/POST `/dispensations`, GET `/dispensations/{id}`
- **Facturation** : GET/POST `/api/invoices`, GET/PATCH `/{id}`, POST `/{id}/payments`
- **Rapports** : GET `/api/reports/overview`, `/revenue`, `/stock`
- **Audit** : GET `/api/audit-logs`

## ✅ État des vagues

| Vague | Statut | Contenu |
|---|---|---|
| Vague 1 | ✅ | Correctifs critiques (SQL portable, bugs, sécurité) |
| Lot A | ✅ | Middlewares, Form Requests, rate limiting, JSON uniformes |
| Lot B | ✅ | Audit log (Spatie Activity Log) |
| Lot B-bis | ✅ | 6 Policies Laravel |
| Lot B-ter | ✅ | Form Requests → Policies |
| Lot C1 | ✅ | Tests Pest (factories + 40 tests) |
| Lot C3 | ✅ | CI GitHub Actions + Larastan |
| Vague 3 | ⏳ | Fonctionnel métier |
| Vague 4 | ⏳ | Modernisation (Docker, OpenAPI, etc.) |

## 🔗 Fichiers clés

- `api/routes/api.php`
- `api/bootstrap/app.php`
- `api/app/Http/Controllers/Concerns/ResolvesFacility.php`
- `api/app/Http/Middleware/EnsureFacilityIsActive.php`
- `api/tests/Pest.php`
- `api/phpstan.neon`
