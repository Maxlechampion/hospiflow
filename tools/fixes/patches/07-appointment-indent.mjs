export default {
  id: '07-appointment-indent',
  file: 'api/app/Http/Controllers/AppointmentController.php',
  marker: '// VAGUE1: indentation normalisée',
  ops: [
    {
      type: 'replace',
      from: "$query = Appointment::inFacility($facility)\n            ->with(['patient:id,local_code,first_name,last_name', 'practitioner:id,name'])\n            ->orderBy('scheduled_at');\n\n$date = $request->query('date');\n\nif ($date) {\n            $query->whereDate('scheduled_at', $date);\n        }\n\nreturn response()->json([",
      to: "// VAGUE1: indentation normalisée\n        $query = Appointment::inFacility($facility)\n            ->with(['patient:id,local_code,first_name,last_name', 'practitioner:id,name'])\n            ->orderBy('scheduled_at');\n\n        $date = $request->query('date');\n\n        if ($date) {\n            $query->whereDate('scheduled_at', $date);\n        }\n\n        return response()->json([",
    },
  ],
};
