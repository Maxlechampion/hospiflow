<?php

namespace Database\Factories;

use App\Models\Appointment;
use App\Models\Facility;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

class AppointmentFactory extends Factory
{
    protected $model = Appointment::class;

    public function definition(): array
    {
        return [
            'facility_id' => Facility::factory(),
            'patient_id' => Patient::factory(),
            'practitioner_id' => User::factory(),
            'created_by' => User::factory(),
            'scheduled_at' => Carbon::now()->addDays(random_int(1, 30)),
            'duration_minutes' => 30,
            'status' => 'scheduled',
            'reason' => 'Consultation de suivi',
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
