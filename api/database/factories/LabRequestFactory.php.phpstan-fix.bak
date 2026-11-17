<?php

namespace Database\Factories;

use App\Models\Facility;
use App\Models\LabRequest;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LabRequestFactory extends Factory
{
    protected $model = LabRequest::class;

    public function definition(): array
    {
        return [
            'facility_id' => Facility::factory(),
            'patient_id' => Patient::factory(),
            'consultation_id' => null,
            'requested_by' => User::factory(),
            'panel' => $this->randFrom(['NFS', 'Glycémie', 'Ionogramme', 'CRP', 'Bilan hépatique']),
            'priority' => 'routine',
            'status' => 'pending',
            'notes' => null,
        ];
    }

    private function randLetters(int $length): string
    {
        $letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $result = '';
        for ($i = 0; $i < $length; $i++) {
            $result .= $letters[random_int(0, strlen($letters) - 1)];
        }

        return $result;
    }

    private function randDigits(int $length): string
    {
        $result = '';
        for ($i = 0; $i < $length; $i++) {
            $result .= (string) random_int(0, 9);
        }

        return $result;
    }

    private function randPhone(): string
    {
        return '+229'.$this->randDigits(8);
    }

    private function randFrom(array $items): string
    {
        return $items[array_rand($items)];
    }
}
