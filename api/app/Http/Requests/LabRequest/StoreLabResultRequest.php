<?php

namespace App\Http\Requests\LabRequest;

use App\Models\LabRequest;
use Illuminate\Foundation\Http\FormRequest;

class StoreLabResultRequest extends FormRequest
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
            'results' => ['required', 'array', 'min:1'],
            'results.*.parameter' => ['required', 'string', 'max:150'],
            'results.*.value' => ['required', 'string', 'max:255'],
            'results.*.unit' => ['nullable', 'string', 'max:60'],
            'results.*.reference_range' => ['nullable', 'string', 'max:120'],
            'results.*.is_abnormal' => ['nullable', 'boolean'],
            'interpretation' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
