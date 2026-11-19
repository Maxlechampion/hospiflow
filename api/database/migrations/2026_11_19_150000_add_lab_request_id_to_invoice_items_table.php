<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            if (! Schema::hasColumn('invoice_items', 'lab_request_id')) {
                $table->foreignId('lab_request_id')->nullable()->after('dispensation_id')->constrained('lab_requests')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('invoice_items', function (Blueprint $table) {
            if (Schema::hasColumn('invoice_items', 'lab_request_id')) {
                $table->dropConstrainedForeignId('lab_request_id');
            }
        });
    }
};
