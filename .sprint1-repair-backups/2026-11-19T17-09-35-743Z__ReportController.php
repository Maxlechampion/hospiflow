<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    use ResolvesFacility;

    private const LOW_STOCK_THRESHOLD = 20;

    private const EXPIRY_WINDOW_DAYS = 60;

    public function overview(Request $request): JsonResponse
    {
        $facility = $this->facility($request);
        [$from, $to] = $this->period($request);

        $fromAt = $from.' 00:00:00';
        $toAt = $to.' 23:59:59';

        $patientsTotal = DB::table('patients')
            ->where('facility_id', $facility->id)
            ->count();

        $newPatients = DB::table('patients')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->count();

        $appointmentsByStatus = DB::table('appointments')
            ->where('facility_id', $facility->id)
            ->whereBetween('scheduled_at', [$fromAt, $toAt])
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->status => (int) $row->total]);

        $consultationsTotal = DB::table('consultations')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->count();

        $labRequestsByStatus = DB::table('lab_requests')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->groupBy('status')
            ->selectRaw('status, count(*) as total')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->status => (int) $row->total]);

        $dispensationsTotal = DB::table('dispensations')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->count();

        $invoices = DB::table('invoices')
            ->where('facility_id', $facility->id)
            ->whereBetween('created_at', [$fromAt, $toAt])
            ->where('status', '!=', 'cancelled')
            ->get(['id', 'total_amount']);

        $billedTotal = (int) $invoices->sum('total_amount');

        $paidInPeriod = (int) DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('invoices.facility_id', $facility->id)
            ->whereBetween('payments.paid_at', [$fromAt, $toAt])
            ->sum('payments.amount');

        $issuedInvoices = DB::table('invoices')
            ->where('facility_id', $facility->id)
            ->where('status', 'issued')
            ->get(['id', 'total_amount']);

        $issuedBilled = (int) $issuedInvoices->sum('total_amount');

        $issuedPaid = (int) DB::table('payments')
            ->whereIn('invoice_id', $issuedInvoices->pluck('id'))
            ->sum('amount');

        $outstandingTotal = $issuedBilled - $issuedPaid;

        $recoveryRate = null;

        if ($billedTotal > 0) {
            $recoveryRate = round($paidInPeriod * 100 / $billedTotal, 1);
        }

        return response()->json([
            'report' => [
                'facility' => ['id' => $facility->id, 'code' => $facility->code],
                'period' => ['from' => $from, 'to' => $to],
                'patients' => [
                    'total' => $patientsTotal,
                    'new_in_period' => $newPatients,
                ],
                'appointments_by_status' => $appointmentsByStatus,
                'consultations_in_period' => $consultationsTotal,
                'lab_requests_by_status' => $labRequestsByStatus,
                'dispensations_in_period' => $dispensationsTotal,
                'billing' => [
                    'invoices_in_period' => $invoices->count(),
                    'billed_in_period' => $billedTotal,
                    'paid_in_period' => $paidInPeriod,
                    'outstanding_total' => $outstandingTotal,
                    'recovery_rate_percent' => $recoveryRate,
                ],
            ],
        ]);
    }

    public function revenue(Request $request): JsonResponse
    {
        $facility = $this->facility($request);
        [$from, $to] = $this->period($request);

        $fromAt = $from.' 00:00:00';
        $toAt = $to.' 23:59:59';

        // VAGUE1: revenue portable — regroupement jour calculé en PHP
        $rawPayments = DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('invoices.facility_id', $facility->id)
            ->whereBetween('payments.paid_at', [$fromAt, $toAt])
            ->get(['payments.paid_at', 'payments.amount']);

        $daily = $rawPayments
            ->groupBy(fn ($row) => substr((string) $row->paid_at, 0, 10))
            ->map(fn ($rows, $day) => (object) ['day' => $day, 'total' => $rows->sum('amount')])
            ->sortKeys()
            ->values();

        $byMethod = DB::table('payments')
            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')
            ->where('invoices.facility_id', $facility->id)
            ->whereBetween('payments.paid_at', [$fromAt, $toAt])
            ->groupBy('payments.method')
            ->selectRaw('payments.method as method, sum(payments.amount) as total')
            ->get();

        return response()->json([
            'report' => [
                'period' => ['from' => $from, 'to' => $to],
                'paid_total' => (int) $daily->sum('total'),
                'daily' => $daily->map(fn ($row) => [
                    'day' => $row->day,
                    'total' => (int) $row->total,
                ]),
                'by_method' => $byMethod->map(fn ($row) => [
                    'method' => $row->method,
                    'total' => (int) $row->total,
                ]),
            ],
        ]);
    }

    public function stock(Request $request): JsonResponse
    {
        $facility = $this->facility($request);

        $lowStock = DB::table('drugs as d')
            ->join('drug_lots as s', 's.drug_id', '=', 'd.id')
            ->where('s.facility_id', $facility->id)
            ->groupBy('d.id', 'd.name')
            ->havingRaw('sum(s.quantity) <= ?', [self::LOW_STOCK_THRESHOLD])
            ->selectRaw('d.name as drug, sum(s.quantity) as total_quantity')
            ->get();

        // VAGUE1: stock portable — days_left calculé en PHP
        $expiringLots = DB::table('drug_lots as s')
            ->join('drugs as d', 'd.id', '=', 's.drug_id')
            ->where('s.facility_id', $facility->id)
            ->where('s.quantity', '>', 0)
            ->where('s.expires_at', '<=', now()->addDays(self::EXPIRY_WINDOW_DAYS))
            ->orderBy('s.expires_at')
            ->selectRaw('d.name as drug, s.quantity as quantity, s.expires_at as expiry_date')
            ->get()
            ->map(function ($row) {
                $expiry = Carbon::parse($row->expiry_date);
                $row->days_left = max(0, now()->startOfDay()->diffInDays($expiry->startOfDay(), false));

                return $row;
            });

        return response()->json([
            'report' => [
                'low_stock_threshold' => self::LOW_STOCK_THRESHOLD,
                'low_stock' => $lowStock->map(fn ($item) => [
                    'drug' => $item->drug,
                    'total_quantity' => (int) $item->total_quantity,
                ]),
                'expiring_window_days' => self::EXPIRY_WINDOW_DAYS,
                'expiring_lots' => $expiringLots->map(fn ($lot) => [
                    'drug' => $lot->drug,
                    'quantity' => (int) $lot->quantity,
                    'expiry_date' => $lot->expiry_date,
                    'days_left' => (int) $lot->days_left,
                ]),
            ],
        ]);
    }

    private function period(Request $request): array
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ], [
            'to.after_or_equal' => 'La date de fin doit suivre la date de début.',
        ]);

        $from = $data['from'] ?? now()->subDays(29)->toDateString();
        $to = $data['to'] ?? now()->toDateString();

        return [$from, $to];
    }

    public function export(Request $request)
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
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ];

        $callback = function () use ($facility, $from, $to, $patientsTotal, $newPatients, $consultationsTotal, $billedTotal, $paidInPeriod) {
            $file = fopen('php://output', 'w');
            // Ajout du BOM (Byte Order Mark) pour qu'Excel ouvre le fichier en UTF-8 sans caractères bizarres
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

            fputcsv($file, ['RAPPORT D\'ACTIVITÉ', $facility->name]);
            fputcsv($file, ['Période', $from.' au '.$to]);
            fputcsv($file, []); // Ligne vide
            fputcsv($file, ['Indicateur', 'Valeur']);
            fputcsv($file, ['Total Patients', $patientsTotal]);
            fputcsv($file, ['Nouveaux Patients (période)', $newPatients]);
            fputcsv($file, ['Consultations (période)', $consultationsTotal]);
            fputcsv($file, ['Chiffre d\'affaires facturé (période)', $billedTotal]);
            fputcsv($file, ['Encaissements (période)', $paidInPeriod]);

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
