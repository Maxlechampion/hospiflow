<?php

namespace Database\Factories;

use App\Models\MasterPatientIndex;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class MasterPatientIndexFactory extends Factory
{
    protected $model = MasterPatientIndex::class;

    public function definition(): array
    {
        return [
            'id' => Str::uuid()->toString(),
            'hospiflow_code' => 'HF-'.strtoupper($this->randLetters(6)),
            'first_name' => 'Patient'.$this->randDigits(3),
            'last_name' => 'Nom'.$this->randDigits(3),
            'date_of_birth' => '19'.$this->randDigits(2).'-0'.random_int(1, 9).'-1'.$this->randDigits(1),
            'gender' => $this->randFrom(['male', 'female', 'other']),
            'phone' => $this->randPhone(),
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
