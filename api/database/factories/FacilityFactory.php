<?php

namespace Database\Factories;

use App\Models\Facility;
use Illuminate\Database\Eloquent\Factories\Factory;

class FacilityFactory extends Factory
{
    protected $model = Facility::class;

    public function definition(): array
    {
        return [
            'code' => 'FAC'.$this->randLetters(3),
            'name' => 'Clinique '.$this->randFrom(['Centrale', 'Du Nord', 'Du Sud', 'Espoir', 'La Paix', 'Saint-Jean']),
            'city' => $this->randFrom(['Cotonou', 'Porto-Novo', 'Parakou', 'Abomey', 'Natitingou']),
            'address' => 'Rue '.$this->randDigits(3).', Quartier '.$this->randLetters(1),
            'phone' => $this->randPhone(),
            'email' => 'contact'.$this->randDigits(4).'@clinique.test',
            'is_active' => true,
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
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
