#!/usr/bin/env node
/**
 * HOSPIFLOW — Sprint 1 Repair (CommonJS, Windows-friendly)
 * N'applique QUE les patches ABSENT (ne touche pas aux PRESENT).
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const ROOT = process.cwd();
const API = path.join(ROOT, 'api');
const BACKUP = path.join(ROOT, '.sprint1-repair-backups');
const TS = new Date().toISOString().replace(/[:.]/g, '-');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY = (args.find(a => a.startsWith('--only=')) || '').replace('--only=', '')
    .split(',').map(s => s.trim()).filter(Boolean);

const C = { r: '\x1b[0m', red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', cyn: '\x1b[36m', b: '\x1b[1m', d: '\x1b[2m' };
const ok = m => console.log(`${C.grn}✅${C.r} ${m}`);
const warn = m => console.log(`${C.yel}⚠️${C.r}  ${m}`);
const err = m => console.log(`${C.red}❌${C.r} ${m}`);
const info = m => console.log(`${C.cyn}ℹ️${C.r}  ${m}`);
const title = m => console.log(`\n${C.b}${C.cyn}━━━ ${m} ━━━${C.r}\n`);

function read(rel) {
    const full = path.join(API, rel);
    if (!fs.existsSync(full)) throw new Error(`Absent : api/${rel}`);
    return { full, content: fs.readFileSync(full, 'utf8') };
}

function backup(full, rel) {
    if (!APPLY) return;
    if (!fs.existsSync(BACKUP)) fs.mkdirSync(BACKUP, { recursive: true });
    const dst = path.join(BACKUP, `${TS}__${rel.replace(/[/\\]/g, '__')}`);
    fs.writeFileSync(dst, fs.readFileSync(full));
}

function replaceOnce(content, search, repl, id) {
    const n = content.split(search).length - 1;
    if (n === 0) throw new Error(`[${id}] Pattern introuvable (0 occurrence).`);
    if (n > 1) throw new Error(`[${id}] Pattern ambigu (${n} occurrences).`);
    return content.replace(search, repl);
}

function patch(spec) {
    if (ONLY.length && !ONLY.includes(spec.id)) { info(`[${spec.id}] skipped`); return 'skip'; }
    console.log(`${C.b}[${spec.id}]${C.r} ${spec.title}`);

    try {
        const { full, content } = read(spec.file);
        // Skip si déjà appliqué
        if (spec.skipIf && content.includes(spec.skipIf)) {
            warn(`[${spec.id}] Déjà appliqué (skip)`);
            return 'skip';
        }
        const next = replaceOnce(content, spec.search, spec.replacement, spec.id);
        if (spec.after && !next.includes(spec.after)) {
            throw new Error(`[${spec.id}] Sanity check échoué : "${spec.after}" absent.`);
        }
        if (APPLY) { backup(full, spec.file); fs.writeFileSync(full, next); }
        ok(`[${spec.id}] ${APPLY ? 'Appliqué' : 'Dry-run OK'}`);
        return 'ok';
    } catch (e) {
        err(`[${spec.id}] ${e.message}`);
        return 'err';
    }
}

// ============================================================
// PATCHES À APPLIQUER (uniquement ABSENT)
// ============================================================
const PATCHES = [

    // 1.2 — nextLocalCode avec facility_counters
    {
        id: '1.2',
        title: 'PatientController::nextLocalCode — séquence anti-race',
        file: 'app/Http/Controllers/PatientController.php',
        skipIf: 'facility_counters',
        search: `    private function nextLocalCode(Facility $facility): string
    {
        $count = Patient::withTrashed()->where('facility_id', $facility->id)->count() + 1;

        return 'P-'.strtoupper($facility->code).'-'
            .str_pad((string) $count, 4, '0', STR_PAD_LEFT);
    }`,
        replacement: `    private function nextLocalCode(Facility $facility): string
    {
        $counter = DB::table('facility_counters')
            ->where('facility_id', $facility->id)
            ->lockForUpdate()
            ->first();

        if (! $counter) {
            DB::table('facility_counters')->insert([
                'facility_id' => $facility->id,
                'patient_sequence' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $next = 1;
        } else {
            $next = $counter->patient_sequence + 1;
            DB::table('facility_counters')
                ->where('facility_id', $facility->id)
                ->update(['patient_sequence' => $next, 'updated_at' => now()]);
        }

        return 'P-'.strtoupper($facility->code).'-'
            .str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }`,
        after: 'facility_counters',
    },

    // 1.3a — import DB ConsultationController
    {
        id: '1.3a',
        title: 'ConsultationController — import DB',
        file: 'app/Http/Controllers/ConsultationController.php',
        skipIf: 'use Illuminate\\Support\\Facades\\DB;',
        search: `use App\\Models\\Patient;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;`,
        replacement: `use App\\Models\\Patient;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\DB;`,
        after: 'use Illuminate\\Support\\Facades\\DB;',
    },
    // 1.3b — transaction body Consultation
    {
        id: '1.3b',
        title: 'ConsultationController::store — transaction',
        file: 'app/Http/Controllers/ConsultationController.php',
        skipIf: 'return $consultation;',
        search: `        $consultation = Consultation::create([
            'facility_id' => $facility->id,
            'patient_id' => $patient->id,
            'appointment_id' => $appointment?->id,
            'practitioner_id' => $request->user()->id,
            'created_by' => $request->user()->id,
            'chief_complaint' => $data['chief_complaint'],
            'examination' => $data['examination'] ?? null,
            'diagnosis' => $data['diagnosis'] ?? null,
            'treatment' => $data['treatment'] ?? null,
            'follow_up_date' => $data['follow_up_date'] ?? null,
        ]);

        if ($appointment && in_array($appointment->status, ['scheduled', 'confirmed'], true)) {
            $appointment->status = 'done';
            $appointment->save();
        }`,
        replacement: `        $consultation = DB::transaction(function () use ($facility, $patient, $appointment, $data, $request) {
            $consultation = Consultation::create([
                'facility_id' => $facility->id,
                'patient_id' => $patient->id,
                'appointment_id' => $appointment?->id,
                'practitioner_id' => $request->user()->id,
                'created_by' => $request->user()->id,
                'chief_complaint' => $data['chief_complaint'],
                'examination' => $data['examination'] ?? null,
                'diagnosis' => $data['diagnosis'] ?? null,
                'treatment' => $data['treatment'] ?? null,
                'follow_up_date' => $data['follow_up_date'] ?? null,
            ]);

            if ($appointment && in_array($appointment->status, ['scheduled', 'confirmed'], true)) {
                $appointment->status = 'done';
                $appointment->save();
            }

            return $consultation;
        });`,
        after: 'DB::transaction(function () use ($facility, $patient, $appointment',
    },

    // 1.4 — ReportController::export complet
    {
        id: '1.4',
        title: 'ReportController::export — permission + CSV + formatage',
        file: 'app/Http/Controllers/ReportController.php',
        skipIf: 'private function csvSafe',
        search: `        public function export(Request $request)
    {
        $facility = $this->facility($request);
        [$from, $to] = $this->period($request);
        $fromAt = $from.' 00:00:00';
        $toAt = $to.' 23:59:59';

        // Récupération des métriques (mêmes que dans overview)
        $patientsTotal = DB::table('patients')->where('facility_id', $facility->id)->count();
        $newPatients = DB::table('patients')->where('facility_id', $facility->id)->whereBetween('created_at', [$fromAt, $toAt])->count();
        $consultationsTotal = DB::table('consultations')->where('facility_id', $facility->id)->whereBetween('created_at', [$fromAt, $toAt])->count();
        
        $billedTotal = (int) DB::table('invoices')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->where('status', '!=', 'cancelled')
            ->sum('total_amount');
            
        $paidInPeriod = (int) DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('invoices.facility_id', $facility->id)
            ->whereBetween('payments.paid_at', [$fromAt, $toAt])
            ->sum('payments.amount');

        $filename = "rapport_{$facility->code}_{$from}_{$to}.csv";
        
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\\"$filename\\"",
        ];
        
        $callback = function() use ($facility, $from, $to, $patientsTotal, $newPatients, $consultationsTotal, $billedTotal, $paidInPeriod) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));
            
            fputcsv($file, ['RAPPORT D\\'ACTIVITÉ', $facility->name]);
            fputcsv($file, ['Période', $from . ' au ' . $to]);
            fputcsv($file, []); // Ligne vide
            fputcsv($file, ['Indicateur', 'Valeur']);
            fputcsv($file, ['Total Patients', $patientsTotal]);
            fputcsv($file, ['Nouveaux Patients (période)', $newPatients]);
            fputcsv($file, ['Consultations (période)', $consultationsTotal]);
            fputcsv($file, ['Chiffre d\\'affaires facturé (période)', $billedTotal]);
            fputcsv($file, ['Encaissements (période)', $paidInPeriod]);
            
            fclose($file);
        };
        
        return response()->stream($callback, 200, $headers);
    }`,
        replacement: `    public function export(Request $request)
    {
        if (! $request->user()->can('reports.view')) {
            abort(403, 'Vous n\\'avez pas accès aux exports de rapports.');
        }

        $facility = $this->facility($request);
        [$from, $to] = $this->period($request);
        $fromAt = $from.' 00:00:00';
        $toAt = $to.' 23:59:59';

        $patientsTotal = DB::table('patients')->where('facility_id', $facility->id)->count();
        $newPatients = DB::table('patients')->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])->count();
        $consultationsTotal = DB::table('consultations')->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])->count();

        $billedTotal = (int) DB::table('invoices')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->where('status', '!=', 'cancelled')
            ->sum('total_amount');

        $paidInPeriod = (int) DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('invoices.facility_id', $facility->id)
            ->whereBetween('payments.paid_at', [$fromAt, $toAt])
            ->sum('payments.amount');

        $filename = "rapport_{$facility->code}_{$from}_{$to}.csv";

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\\"$filename\\"",
        ];

        $callback = function () use ($facility, $from, $to, $patientsTotal, $newPatients, $consultationsTotal, $billedTotal, $paidInPeriod) {
            $file = fopen('php://output', 'w');
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

            $safe = fn ($v) => $this->csvSafe((string) $v);

            fputcsv($file, [$safe('RAPPORT D\\'ACTIVITÉ'), $safe($facility->name)]);
            fputcsv($file, [$safe('Période'), $safe($from.' au '.$to)]);
            fwrite($file, "\\n");
            fputcsv($file, [$safe('Indicateur'), $safe('Valeur')]);
            fputcsv($file, [$safe('Total Patients'), $patientsTotal]);
            fputcsv($file, [$safe('Nouveaux Patients (période)'), $newPatients]);
            fputcsv($file, [$safe('Consultations (période)'), $consultationsTotal]);
            fputcsv($file, [$safe('Chiffre d\\'affaires facturé (période)'), $billedTotal]);
            fputcsv($file, [$safe('Encaissements (période)'), $paidInPeriod]);

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function csvSafe(string $value): string
    {
        if ($value === '') {
            return $value;
        }

        $firstChar = $value[0];

        if (in_array($firstChar, ['=', '+', '-', '@', "\\t", "\\r"], true)) {
            return "'".$value;
        }

        return $value;
    }`,
        after: 'private function csvSafe',
    },

    // 1.7 — LabRequestController::storeResult
    {
        id: '1.7',
        title: 'LabRequestController::storeResult — anti-écrasement',
        file: 'app/Http/Controllers/LabRequestController.php',
        skipIf: '$labRequest->result()->exists()',
        search: `        if ($labRequest->status === 'completed') {
            abort(422, 'Cette demande a déjà un résultat enregistré.');
        }

        $data = $request->validate([
            'values' => ['required', 'string', 'max:4000'],
            'conclusion' => ['nullable', 'string', 'max:1000'],
        ], [
            'values.required' => 'Les valeurs des analyses sont obligatoires.',
        ]);

        $labRequest->result()->updateOrCreate(
            [],
            [
                'values' => $data['values'],
                'conclusion' => $data['conclusion'] ?? null,
                'resulted_by' => $request->user()->id,
                'resulted_at' => now(),
            ]
        );`,
        replacement: `        if ($labRequest->status === 'completed') {
            abort(422, 'Cette demande a déjà un résultat enregistré.');
        }

        if ($labRequest->result()->exists()) {
            abort(422, 'Un résultat existe déjà pour cette demande.');
        }

        $data = $request->validate([
            'values' => ['required', 'string', 'max:4000'],
            'conclusion' => ['nullable', 'string', 'max:1000'],
        ], [
            'values.required' => 'Les valeurs des analyses sont obligatoires.',
        ]);

        $labRequest->result()->create([
            'values' => $data['values'],
            'conclusion' => $data['conclusion'] ?? null,
            'resulted_by' => $request->user()->id,
            'resulted_at' => now(),
        ]);`,
        after: '$labRequest->result()->create',
    },

    // 1.8 — PharmacyController::dispense
    {
        id: '1.8',
        title: 'PharmacyController::dispense — blocage 0 XOF',
        file: 'app/Http/Controllers/PharmacyController.php',
        skipIf: 'le prix unitaire de ce médicament',
        search: `        $quantity = $data['quantity'];
        $notes = $data['notes'] ?? null;
        $createInvoice = ! empty($data['create_invoice']);
        $invoiceDueDate = $data['invoice_due_date'] ?? null;`,
        replacement: `        $quantity = $data['quantity'];
        $notes = $data['notes'] ?? null;
        $createInvoice = ! empty($data['create_invoice']);
        $invoiceDueDate = $data['invoice_due_date'] ?? null;

        if ($createInvoice && (int) $drug->unit_price <= 0) {
            abort(422, 'Impossible de générer une facture : le prix unitaire de ce médicament n\\'est pas défini.');
        }`,
        after: 'le prix unitaire de ce médicament',
    },

    // 1.9 — InvoiceController::store
    {
        id: '1.9',
        title: 'InvoiceController::store — blocage total 0',
        file: 'app/Http/Controllers/InvoiceController.php',
        skipIf: 'doit être supérieur à 0 XOF',
        search: `            $total = 0;

            foreach ($data['items'] as $item) {
                $total += $item['quantity'] * $item['unit_price'];
            }

            $record = Invoice::create([`,
        replacement: `            $total = 0;

            foreach ($data['items'] as $item) {
                $total += $item['quantity'] * $item['unit_price'];
            }

            if ($total <= 0) {
                abort(422, 'Le montant total de la facture doit être supérieur à 0 XOF.');
            }

            $record = Invoice::create([`,
        after: 'doit être supérieur à 0 XOF',
    },

    // 1.10 — AuthController::login
    {
        id: '1.10',
        title: 'AuthController::login — timing-safe',
        file: 'app/Http/Controllers/AuthController.php',
        skipIf: 'dummyHash',
        search: `        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Identifiants incorrects.',
            ]);
        }

        if (! $user->is_active) {
            abort(403, 'Compte désactivé. Contactez un administrateur.');
        }`,
        replacement: `        $user = User::where('email', $data['email'])->first();

        $dummyHash = '$2y$12$eImiTXuWVxfM37uY4JANjQeQ1K4m6d8f8Zz1qW2rN3sT4uV5wX6yO';

        if (! $user) {
            Hash::check($data['password'], $dummyHash);
            throw ValidationException::withMessages([
                'email' => 'Identifiants incorrects.',
            ]);
        }

        if (! $user->is_active) {
            Hash::check($data['password'], $user->password);
            abort(403, 'Compte désactivé. Contactez un administrateur.');
        }

        if (! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Identifiants incorrects.',
            ]);
        }`,
        after: '$dummyHash',
    },

    // 1.11 — AuditLogController whitelist
    {
        id: '1.11',
        title: 'AuditLogController — whitelist subject_type',
        file: 'app/Http/Controllers/AuditLogController.php',
        skipIf: 'Type de sujet non audité',
        search: `        if ($type = $request->query('subject_type')) {
            $query->where('subject_type', 'App\\\\Models\\\\'.$type);
        }`,
        replacement: `        if ($type = $request->query('subject_type')) {
            $allowed = ['Patient', 'Consultation', 'Invoice', 'DrugLot', 'Appointment', 'Prescription'];
            if (! in_array($type, $allowed, true)) {
                abort(422, 'Type de sujet non audité.');
            }
            $query->where('subject_type', 'App\\\\Models\\\\'.$type);
        }`,
        after: 'Type de sujet non audité',
    },
];

// ============================================================
// MAIN
// ============================================================
console.log(`\n${C.b}${C.cyn}╔══════════════════════════════════════════════════════╗${C.r}`);
console.log(`${C.b}${C.cyn}║  HOSPIFLOW — Sprint 1 REPAIR (${APPLY ? 'APPLY' : 'DRY-RUN'})              ║${C.r}`);
console.log(`${C.b}${C.cyn}╚══════════════════════════════════════════════════════╝${C.r}\n`);

if (!fs.existsSync(path.join(API, 'artisan'))) {
    err('api/artisan introuvable. Lance depuis la racine du repo.');
    process.exit(1);
}

const results = PATCHES.map(patch);

title('RAPPORT');
const nOk = results.filter(r => r === 'ok').length;
const nSkip = results.filter(r => r === 'skip').length;
const nErr = results.filter(r => r === 'err').length;
console.log(`  ${C.grn}✅ OK${C.r}       : ${nOk}`);
console.log(`  ${C.yel}⚠️  Skipped${C.r}  : ${nSkip}`);
console.log(`  ${C.red}❌ Erreurs${C.r}  : ${nErr}`);

if (!APPLY) {
    console.log(`\n${C.d}Dry-run. Relance avec --apply pour appliquer.${C.r}\n`);
} else if (nErr === 0) {
    ok('\n✨ Repair terminé. Lance maintenant la validation.');
} else {
    warn('\nCertains patches ont échoué. Vérifie les patterns.');
    process.exit(1);
}