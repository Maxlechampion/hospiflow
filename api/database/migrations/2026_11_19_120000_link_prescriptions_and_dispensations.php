<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prescription_items', function (Blueprint $table) {
            if (! Schema::hasColumn('prescription_items', 'dispensed_quantity')) {
                $table->unsignedInteger('dispensed_quantity')->default(0)->after('quantity');
            }
        });

        Schema::table('dispensations', function (Blueprint $table) {
            if (! Schema::hasColumn('dispensations', 'prescription_id')) {
                $table->foreignId('prescription_id')->nullable()->after('consultation_id')->constrained('prescriptions')->nullOnDelete();
            }
            if (! Schema::hasColumn('dispensations', 'prescription_item_id')) {
                $table->foreignId('prescription_item_id')->nullable()->after('prescription_id')->constrained('prescription_items')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('dispensations', function (Blueprint $table) {
            if (Schema::hasColumn('dispensations', 'prescription_item_id')) {
                $table->dropConstrainedForeignId('prescription_item_id');
            }
            if (Schema::hasColumn('dispensations', 'prescription_id')) {
                $table->dropConstrainedForeignId('prescription_id');
            }
        });

        Schema::table('prescription_items', function (Blueprint $table) {
            if (Schema::hasColumn('prescription_items', 'dispensed_quantity')) {
                $table->dropColumn('dispensed_quantity');
            }
        });
    }
};
