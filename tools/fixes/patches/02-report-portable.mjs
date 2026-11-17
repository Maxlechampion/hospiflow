export default {
  id: '02-report-portable',
  file: 'api/app/Http/Controllers/ReportController.php',
  marker: '// VAGUE1: revenue portable',
  ops: [
    {
      type: 'replace',
      from: "\$daily = DB::table('payments')\n            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')\n            ->where('invoices.facility_id', \$facility->id)\n            ->whereBetween('payments.paid_at', [\$fromAt, \$toAt])\n            ->groupByRaw(\"to_char(payments.paid_at, 'YYYY-MM-DD')\")\n            ->orderByRaw(\"to_char(payments.paid_at, 'YYYY-MM-DD')\")\n            ->selectRaw(\"to_char(payments.paid_at, 'YYYY-MM-DD') as day, sum(payments.amount) as total\")\n            ->get();",
      to: "// VAGUE1: revenue portable — regroupement jour calculé en PHP\n        \$rawPayments = DB::table('payments')\n            ->join('invoices', 'payments.invoice_id', '=', 'invoices.id')\n            ->where('invoices.facility_id', \$facility->id)\n            ->whereBetween('payments.paid_at', [\$fromAt, \$toAt])\n            ->get(['payments.paid_at', 'payments.amount']);\n\n        \$daily = \$rawPayments\n            ->groupBy(fn (\$row) => substr((string) \$row->paid_at, 0, 10))\n            ->map(fn (\$rows, \$day) => (object) ['day' => \$day, 'total' => \$rows->sum('amount')])\n            ->sortKeys()\n            ->values();",
    },
    {
      type: 'replace',
      from: '->selectRaw(\"d.name as drug, s.quantity as quantity, s.expires_at as expiry_date, extract(day from (s.expires_at - now())) as days_left\")\n            ->get();',
      to: "->selectRaw('d.name as drug, s.quantity as quantity, s.expires_at as expiry_date')\n            ->get()\n            ->map(function (\$row) {\n                \$expiry = \\Illuminate\\Support\\Carbon::parse(\$row->expiry_date);\n                \$row->days_left = max(0, now()->startOfDay()->diffInDays(\$expiry->startOfDay(), false));\n                return \$row;\n            });",
    },
  ],
};
