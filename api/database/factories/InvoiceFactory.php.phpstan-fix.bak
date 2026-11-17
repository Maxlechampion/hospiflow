<?php

namespace Database\Factories;

use App\Models\Facility;
use App\Models\Invoice;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class InvoiceFactory extends Factory
{
    protected $model = Invoice::class;

    public function definition(): array
    {
        return [
            'facility_id' => Facility::factory(),
            'patient_id' => Patient::factory(),
            'consultation_id' => null,
            'created_by' => User::factory(),
            'number' => 'FAC-'.str_pad((string) random_int(1, 99999), 5, '0', STR_PAD_LEFT),
            'status' => 'draft',
            'total_amount' => 10000,
            'due_date' => now()->addDays(30),
        ];
    }

    public function issued(): static
    {
        return $this->state(fn () => ['status' => 'issued']);
    }

    public function paid(): static
    {
        return $this->state(fn () => ['status' => 'paid']);
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
