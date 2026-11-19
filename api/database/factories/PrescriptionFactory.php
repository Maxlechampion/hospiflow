<?php

namespace Database\Factories;

use App\Models\Facility;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class PrescriptionFactory extends Factory
{
    protected $model = Prescription::class;

    public function definition(): array
    {
        return [
            'facility_id' => Facility::factory(),
            'patient_id' => Patient::factory(),
            'practitioner_id' => User::factory(),
            'created_by' => User::factory(),
            'status' => 'active',
            'notes' => null,
            'prescribed_at' => now()->toDateString(),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => 'draft']);
    }
}
