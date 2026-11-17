<?php

namespace Database\Factories;

use App\Models\Drug;
use App\Models\DrugLot;
use App\Models\Facility;
use Illuminate\Database\Eloquent\Factories\Factory;

class DrugLotFactory extends Factory
{
    protected $model = DrugLot::class;

    public function definition(): array
    {
        return [
            'facility_id' => Facility::factory(),
            'drug_id' => Drug::factory(),
            'lot_number' => 'LOT-'.$this->randDigits(4).$this->randLetters(2),
            'quantity' => random_int(10, 500),
            'expires_at' => now()->addMonths(random_int(3, 24)),
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
