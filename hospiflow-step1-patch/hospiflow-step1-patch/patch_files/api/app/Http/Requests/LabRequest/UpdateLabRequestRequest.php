<?php

namespace App\Http\Requests\LabRequest;

use App\Models\LabRequest;
use Illuminate\Foundation\Http\FormRequest;

class UpdateLabRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        $labRequest = LabRequest::find($this->route('labRequestId'));

        return $labRequest !== null
            && $this->user()->can('update', $labRequest);
    }

    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:pending,in_progress,cancelled'],
        ];
    }

    public function messages(): array
    {
        return [
            'status.in' => 'Statut invalide (la complétion passe par la saisie du résultat).',
        ];
    }
}
