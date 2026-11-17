export default {
  id: '04-pharmacy-notes-fix',
  file: 'api/app/Http/Controllers/PharmacyController.php',
  marker: '// VAGUE1: \$notes passé explicitement',
  ops: [
    {
      type: 'replace',
      from: '[\$dispensation, \$remaining] = DB::transaction(function () use (\$facility, \$patient, \$consultation, \$drug, \$quantity, \$request) {',
      to: "\$notes = \$data['notes'] ?? null; // VAGUE1: \$notes passé explicitement\n\n        [\$dispensation, \$remaining] = DB::transaction(function () use (\$facility, \$patient, \$consultation, \$drug, \$quantity, \$request, \$notes) {",
    },
    {
      type: 'replace',
      from: "'notes' => request('notes'),",
      to: "'notes' => \$notes,",
    },
  ],
};
