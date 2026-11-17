<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Dispensation extends Model
{
    protected $fillable = [
        'facility_id',
        'patient_id',
        'consultation_id',
        'drug_id',
        'dispensed_by',
        'quantity',
        'notes',
    ];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function drug(): BelongsTo
    {
        return $this->belongsTo(Drug::class);
    }

    public function dispenser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'dispensed_by');
    }

    public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
