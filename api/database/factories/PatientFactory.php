<?php

namespace Database\Factories;

use App\Models\Facility;
use App\Models\MasterPatientIndex;
use App\Models\Patient;
use Illuminate\Database\Eloquent\Factories\Factory;

class PatientFactory extends Factory
{
    protected $model = Patient::class;

    public function definition(): array
    {
        return [
            'facility_id' => Facility::factory(),
            'mpi_id' => MasterPatientIndex::factory(),
            'local_code' => 'P-TEST-'.$this->randDigits(4),
            'first_name' => 'Prénom'.$this->randDigits(2),
            'last_name' => 'Nom'.$this->randDigits(2),
            'date_of_birth' => '199'.random_int(0, 9).'-0'.random_int(1, 9).'-1'.random_int(0, 9),
            'gender' => $this->randFrom(['male', 'female', 'other']),
            'phone' => $this->randPhone(),
            'address' => 'Adresse '.$this->randDigits(2),
            'blood_group' => $this->randFrom(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']),
            'allergies' => null,
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
