<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facility_counters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->unique()->constrained()->cascadeOnDelete();
            $table->unsignedInteger('patient_sequence')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facility_counters');
    }
};
