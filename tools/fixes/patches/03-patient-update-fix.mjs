export default {
  id: '03-patient-update-fix',
  file: 'api/app/Http/Controllers/PatientController.php',
  marker: '// VAGUE1: update respecte les null explicites',
  ops: [
    {
      type: 'replace',
      from: '$patient->update(array_filter($data, fn ($v) => $v !== null));',
      to: "// VAGUE1: update respecte les null explicites\n        $updatable = ['first_name', 'last_name', 'date_of_birth', 'gender', 'phone', 'address', 'blood_group', 'allergies'];\n        $payload = [];\n        foreach ($updatable as $field) {\n            if (array_key_exists($field, $data)) {\n                $payload[$field] = $data[$field];\n            }\n        }\n        $patient->update($payload);",
    },
  ],
};
