<?php

namespace Database\Seeders;

use App\Models\Facility;
use App\Models\MasterPatientIndex;
use App\Models\Patient;
use Illuminate\Database\Seeder;

class PatientsSeeder extends Seeder
{
    public function run(): void
    {
        $csm = Facility::where('code', 'CSM')->firstOrFail();

        $mpi = MasterPatientIndex::firstOrCreate(
            ['hospiflow_code' => 'HF-DEMO0001'],
            [
                'first_name' => 'Awa',
                'last_name' => 'Doe',
                'date_of_birth' => '1990-05-14',
                'gender' => 'female',
                'phone' => '+229 97 00 00 01',
            ]
        );

        Patient::firstOrCreate(
            ['facility_id' => $csm->id, 'mpi_id' => $mpi->id],
            [
                'local_code' => 'P-CSM-0001',
                'first_name' => 'Awa',
                'last_name' => 'Doe',
                'date_of_birth' => '1990-05-14',
                'gender' => 'female',
                'phone' => '+229 97 00 00 01',
                'address' => 'Cotonou, Bénin',
                'blood_group' => 'O+',
                'allergies' => null,
            ]
        );
    }
}
