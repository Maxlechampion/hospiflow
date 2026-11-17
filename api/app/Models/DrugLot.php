<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Contracts\Activity;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class DrugLot extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'facility_id',
        'drug_id',
        'lot_number',
        'quantity',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'date',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['quantity', 'expires_at', 'lot_number'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('drug_lot');
    }

    public function tapActivity(Activity $activity): void
    {
        $activity->properties = $activity->properties->merge([
            'facility_id' => $this->facility_id,
        ]);
    }

    public function drug(): BelongsTo
    {
        return $this->belongsTo(Drug::class);
    }

    public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
