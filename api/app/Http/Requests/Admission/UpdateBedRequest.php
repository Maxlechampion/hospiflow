<?php

namespace App\Http\Requests\Admission;

use App\Models\Bed;
use Illuminate\Foundation\Http\FormRequest;

class UpdateBedRequest extends FormRequest
{
    public function authorize(): bool
    {
        $bed = $this->route('bed') ?? $this->route('bedId');
        if ($bed instanceof Bed) {
            return $this->user()?->can('update', $bed) ?? false;
        }

        return $this->user()?->can('create', Bed::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'ward' => ['sometimes', 'required', 'string', 'max:120'],
            'room_number' => ['nullable', 'string', 'max:60'],
            'code' => ['sometimes', 'required', 'string', 'max:60'],
            'status' => ['nullable', 'string', 'in:available,occupied,maintenance'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
