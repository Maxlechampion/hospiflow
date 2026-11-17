<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;

class AuditLogController extends Controller
{
    use ResolvesFacility;

    /**
     * Liste les logs d'audit de l'établissement courant.
     *
     * Query params :
     *   subject_type  (ex: Patient, Invoice)  - optionnel
     *   subject_id    (int)                   - optionnel
     *   event         (created, updated, deleted) - optionnel
     *   from          (Y-m-d)                 - optionnel
     *   to            (Y-m-d)                 - optionnel
     *   per_page      (int, 1-100, défaut 25)
     */
    public function index(Request $request): JsonResponse
    {
        $facility = $this->facility($request);

        if (! $request->user()->can('reports.view')) {
            abort(403, 'Vous n\'avez pas accès aux logs d\'audit.');
        }

        $query = Activity::query()
            ->where('properties->facility_id', $facility->id)
            ->with(['causer:id,name,email'])
            ->orderByDesc('created_at');

        if ($type = $request->query('subject_type')) {
            $query->where('subject_type', 'App\\Models\\'.$type);
        }

        if ($id = $request->query('subject_id')) {
            $query->where('subject_id', (int) $id);
        }

        if ($event = $request->query('event')) {
            $query->where('event', $event);
        }

        if ($from = $request->query('from')) {
            $query->where('created_at', '>=', $from.' 00:00:00');
        }

        if ($to = $request->query('to')) {
            $query->where('created_at', '<=', $to.' 23:59:59');
        }

        $perPage = min((int) $request->query('per_page', 25), 100);
        $logs = $query->paginate($perPage);

        return response()->json([
            'activity_logs' => $logs->getCollection()->map(fn ($activity) => [
                'id' => $activity->id,
                'log_name' => $activity->log_name,
                'event' => $activity->event,
                'description' => $activity->description,
                'subject' => [
                    'type' => $activity->subject_type,
                    'id' => $activity->subject_id,
                ],
                'causer' => $activity->causer ? [
                    'id' => $activity->causer->id,
                    'name' => $activity->causer->name,
                    'email' => $activity->causer->email,
                ] : null,
                'changes' => [
                    'old' => $activity->properties['old'] ?? null,
                    'new' => $activity->properties['attributes'] ?? null,
                ],
                'created_at' => $activity->created_at->format('Y-m-d H:i:s'),
            ]),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }
}
