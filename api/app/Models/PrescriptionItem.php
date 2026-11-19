<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PrescriptionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'prescription_id',
        'drug_id',
        'dosage',
        'frequency',
        'duration',
        'quantity',
        'dispensed_quantity',
        'instructions',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'dispensed_quantity' => 'integer',
    ];

    public function prescription(): BelongsTo
    {
        return $this->belongsTo(Prescription::class);
    }

    public function drug(): BelongsTo
    {
        return $this->belongsTo(Drug::class);
    }

    /**
     * @return HasMany<Dispensation, $this>
     */
    public function dispensations(): HasMany
    {
        return $this->hasMany(Dispensation::class);
    }

    public function remainingQuantity(): int
    {
        return max(0, (int) $this->quantity - (int) $this->dispensed_quantity);
    }
}
