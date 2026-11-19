<?php

namespace Database\Factories;

use App\Models\Drug;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use Illuminate\Database\Eloquent\Factories\Factory;

class PrescriptionItemFactory extends Factory
{
    protected $model = PrescriptionItem::class;

    public function definition(): array
    {
        return [
            'prescription_id' => Prescription::factory(),
            'drug_id' => Drug::factory(),
            'dosage' => random_int(1, 3).' fois par jour',
            'frequency' => 'Matin, midi, soir',
            'duration' => random_int(3, 14).' jours',
            'quantity' => random_int(1, 30),
            'instructions' => 'À prendre au cours du repas',
            'notes' => null,
        ];
    }
}
