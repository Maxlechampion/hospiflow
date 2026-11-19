<?php

namespace App\Http\Requests\Admission;

use App\Models\Bed;
use Illuminate\Foundation\Http\FormRequest;

class StoreBedRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('create', Bed::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'ward' => ['required', 'string', 'max:120'],
            'room_number' => ['nullable', 'string', 'max:60'],
            'code' => ['required', 'string', 'max:60'],
            'status' => ['nullable', 'string', 'in:available,occupied,maintenance'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
