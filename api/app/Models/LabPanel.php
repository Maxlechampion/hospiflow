<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LabPanel extends Model
{
    use HasFactory;

    protected $fillable = [
        'facility_id',
        'code',
        'name',
        'category',
        'price',
        'turnaround_hours',
        'is_active',
    ];

    protected $casts = [
        'price' => 'integer',
        'turnaround_hours' => 'integer',
        'is_active' => 'boolean',
    ];

    public function facility(): BelongsTo
    {
        return $this->belongsTo(Facility::class);
    }

    /**
     * @return HasMany<LabRequest, $this>
     */
    public function labRequests(): HasMany
    {
        return $this->hasMany(LabRequest::class);
    }

    public function scopeInFacility($query, Facility $facility)
    {
        return $query->where('facility_id', $facility->id);
    }
}
