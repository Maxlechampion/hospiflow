<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drugs', function (Blueprint $table) {
            $table->id();
            $table->string('name', 200)->unique();
            $table->string('form', 100);
            $table->string('dosage', 100)->nullable();
            $table->string('unit', 50);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('drug_lots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->foreignId('drug_id')->constrained()->cascadeOnDelete();
            $table->string('lot_number', 100)->nullable();
            $table->unsignedInteger('quantity')->default(0);
            $table->date('expires_at')->nullable();
            $table->timestamps();

            $table->index(['facility_id', 'drug_id']);
        });

        Schema::create('dispensations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('consultation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('drug_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dispensed_by')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->string('notes', 500)->nullable();
            $table->timestamps();

            $table->index(['facility_id', 'patient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispensations');
        Schema::dropIfExists('drug_lots');
        Schema::dropIfExists('drugs');
    }
};
