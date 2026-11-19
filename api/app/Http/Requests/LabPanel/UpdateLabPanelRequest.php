<?php

namespace App\Http\Requests\LabPanel;

use App\Models\LabPanel;
use Illuminate\Foundation\Http\FormRequest;

class UpdateLabPanelRequest extends FormRequest
{
    public function authorize(): bool
    {
        $panel = $this->route('labPanel') ?? $this->route('labPanelId');
        if ($panel instanceof LabPanel) {
            return $this->user()?->can('update', $panel) ?? false;
        }

        return $this->user()?->can('create', LabPanel::class) ?? false;
    }

    public function rules(): array
    {
        return [
            'code' => ['sometimes', 'required', 'string', 'max:60'],
            'name' => ['sometimes', 'required', 'string', 'max:200'],
            'category' => ['nullable', 'string', 'max:120'],
            'price' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'turnaround_hours' => ['nullable', 'integer', 'min:1', 'max:720'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }
}
