<?php

namespace App\Http\Requests\LabRequest;

use App\Models\LabRequest;
use Illuminate\Foundation\Http\FormRequest;

class UpdateLabRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        $labRequest = $this->route('labRequest') ?? $this->route('lab_request');
        if ($labRequest instanceof LabRequest) {
            return $this->user()?->can('update', $labRequest) ?? false;
        }

        return $this->user()?->can('update', LabRequest::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'test_name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:120'],
            'priority' => ['nullable', 'string', 'in:routine,urgent,stat'],
            'status' => ['nullable', 'string', 'in:pending,collected,processing,completed,cancelled'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
