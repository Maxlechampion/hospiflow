<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('master_patient_index', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('hospiflow_code', 20)->unique();
            $table->string('first_name');
            $table->string('last_name');
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('phone', 30)->nullable();
            $table->timestamps();
        });

        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->uuid('mpi_id');
            $table->foreign('mpi_id')->references('id')
                ->on('master_patient_index')->cascadeOnDelete();
            $table->string('local_code', 30);
            $table->string('first_name');
            $table->string('last_name');
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('address', 255)->nullable();
            $table->string('blood_group', 10)->nullable();
            $table->text('allergies')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['facility_id', 'mpi_id']);
            $table->unique(['facility_id', 'local_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patients');
        Schema::dropIfExists('master_patient_index');
    }
};
