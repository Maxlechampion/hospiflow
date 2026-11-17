export default {
  id: '05-attach-user-secure',
  file: 'api/app/Http/Controllers/FacilityController.php',
  marker: '// VAGUE1: anti-énumération e-mail',
  ops: [
    // 1) Supprimer la règle "exists:users,email" (validation trop stricte + oracle d'énumération)
    {
      type: 'replace',
      from: "'email' => ['required', 'email', 'exists:users,email'],",
      to: "'email' => ['required', 'email'],",
    },
    // 2) Remplacer firstOrFail() par first() + abort neutre
    {
      type: 'replace',
      from: "\$target = User::where('email', \$data['email'])->firstOrFail();",
      to: "// VAGUE1: anti-énumération e-mail\n        \$target = User::where('email', \$data['email'])->first();\n\n        if (! \$target) {\n            abort(422, 'Impossible de rattacher cet utilisateur. Vérifiez l\\'adresse e-mail.');\n        }",
    },
    // 3) Supprimer le message d'erreur existant (devenu inutile)
    {
      type: 'replace',
      from: "        ], [\n            'email.exists' => 'Aucun utilisateur avec cette adresse e-mail.',\n        ]);",
      to: "        ]);",
    },
  ],
};
