<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Contracts\Activity;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Admission extends Model
{
    use HasFactory, LogsActivity;

    public const STATUSES = ['admitted', 'discharged', 'cancelled'];

    protected $fillable = [
        'facility_id',
        'patient_id',
        'bed_id',
        'consultation_id',
        'admitted_by',
        'discharged_by',
        'status',
        'reason',
        'notes',
        'admitted_at',
        'discharged_at',
    ];

    protected $casts = [
        'admitted_at' => 'datetime',
        'discharged_at' => 'datetime',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['status', 'bed_id', 'discharged_at', 'notes'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('admission');
    }

    public function tapActivity(Activity $activity): void
    {
        $activity->properties = $activity->properties->merge([
            'facility_id' => $this->facility_id,
        ]);
    }

    public function facility(): BelongsTo
    {
        return $this->belongsTo(Facility::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function bed(): BelongsTo
    {
        return $this->belongsTo(Bed::class);
    }

    public function consultation(): BelongsTo
    {
        return $this->belongsTo(Consultation::class);
    }

    public function admitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admitted_by');
    }

    public function discharger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'discharged_by');
    }

    public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
