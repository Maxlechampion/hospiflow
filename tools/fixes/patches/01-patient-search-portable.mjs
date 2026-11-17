export default {
  id: '01-patient-search-portable',
  file: 'api/app/Http/Controllers/PatientController.php',
  marker: '$this->portableLike(',
  ops: [
    {
      type: 'replace',
      from: "$w->where('first_name', 'ilike', '%'.$q.'%')\n                    ->orWhere('last_name', 'ilike', '%'.$q.'%')\n                    ->orWhere('local_code', 'ilike', '%'.$q.'%')\n                    ->orWhere('phone', 'ilike', '%'.$q.'%')\n                    ->orWhereHas('mpi', function ($m) use ($q) {\n                        $m->where('hospiflow_code', 'ilike', '%'.$q.'%');\n                    });",
      to: "$w->whereRaw($this->portableLike('first_name'), [$this->likePattern($q)])\n                    ->orWhereRaw($this->portableLike('last_name'), [$this->likePattern($q)])\n                    ->orWhereRaw($this->portableLike('local_code'), [$this->likePattern($q)])\n                    ->orWhereRaw($this->portableLike('phone'), [$this->likePattern($q)])\n                    ->orWhereHas('mpi', function ($m) use ($q) {\n                        $m->whereRaw('LOWER(hospiflow_code) LIKE LOWER(?)', [$this->likePattern($q)]);\n                    });",
    },
    {
      type: 'insertBefore',
      anchor: 'private function nextLocalCode(Facility $facility): string',
      text: "private function portableLike(string $column): string\n    {\n        return \"LOWER({\$column}) LIKE LOWER(?)\";\n    }\n\n    private function likePattern(string $needle): string\n    {\n        return '%' . str_replace(['%', '_'], ['\\\\%', '\\\\_'], $needle) . '%';\n    }\n\n    ",
    },
  ],
};
