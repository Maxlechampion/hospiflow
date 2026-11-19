<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lab_panels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('facility_id')->constrained()->cascadeOnDelete();
            $table->string('code', 60);
            $table->string('name', 200);
            $table->string('category', 120)->nullable();
            $table->unsignedInteger('price')->default(0);
            $table->unsignedInteger('turnaround_hours')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['facility_id', 'code']);
            $table->index(['facility_id', 'is_active']);
        });

        Schema::table('lab_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('lab_requests', 'lab_panel_id')) {
                $table->foreignId('lab_panel_id')->nullable()->after('consultation_id')->constrained('lab_panels')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('lab_requests', function (Blueprint $table) {
            if (Schema::hasColumn('lab_requests', 'lab_panel_id')) {
                $table->dropConstrainedForeignId('lab_panel_id');
            }
        });

        Schema::dropIfExists('lab_panels');
    }
};
