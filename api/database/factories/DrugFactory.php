<?php

namespace Database\Factories;

use App\Models\Drug;
use Illuminate\Database\Eloquent\Factories\Factory;

class DrugFactory extends Factory
{
    protected $model = Drug::class;

    public function definition(): array
    {
        return [
            'name' => 'Médicament '.$this->randLetters(3).' '.random_int(100, 1000).'mg',
            'form' => $this->randFrom(['comprimé', 'sirop', 'injectable', 'gélule']),
            'dosage' => random_int(1, 10).'mg',
            'unit' => $this->randFrom(['boîte', 'flacon', 'ampoule']),
            'is_active' => true,
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
