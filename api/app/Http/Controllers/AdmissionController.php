<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesFacility;
use App\Http\Requests\Admission\CancelAdmissionRequest;
use App\Http\Requests\Admission\DischargeAdmissionRequest;
use App\Http\Requests\Admission\StoreAdmissionRequest;
use App\Models\Admission;
use App\Models\Bed;
use App\Models\Consultation;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Patient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AdmissionController extends Controller
{
    use ResolvesFacility;

    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Admission::class);
        $facility = $this->facility($request);

        $query = Admission::inFacility($facility)
            ->with([
                'patient:id,local_code,first_name,last_name',
                'bed:id,ward,room_number,code,status',
                'admitter:id,name',
                'discharger:id,name',
            ])
            ->orderByDesc('admitted_at');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($patientId = $request->query('patient_id')) {
            $query->where('patient_id', (int) $patientId);
        }

        return response()->json([
            'admissions' => $query->get()->map(fn (Admission $a) => $this->payload($a)),
        ]);
    }

    public function show(Request $request, int $admissionId): JsonResponse
    {
        $facility = $this->facility($request);
        $admission = Admission::inFacility($facility)
            ->with([
                'patient:id,local_code,first_name,last_name',
                'bed:id,ward,room_number,code,status',
                'admitter:id,name',
                'discharger:id,name',
            ])
            ->findOrFail($admissionId);
        $this->authorize('view', $admission);

        return response()->json(['admission' => $this->payload($admission)]);
    }

    public function store(StoreAdmissionRequest $request): JsonResponse
    {
        $facility = $this->facility($request);
        $data = $request->validated();

        $patient = Patient::inFacility($facility)->find($data['patient_id']);
        if (! $patient) {
            abort(422, "Ce patient n'existe pas dans votre établissement.");
        }

        $consultation = null;
        if (! empty($data['consultation_id'])) {
            $consultation = Consultation::inFacility($facility)->find($data['consultation_id']);
            if (! $consultation) {
                abort(422, "Cette consultation n'existe pas dans votre établissement.");
            }
        }

        $bedId = $data['bed_id'] ?? null;
        if ($bedId !== null) {
            $bedCheck = Bed::inFacility($facility)->find($bedId);
            if (! $bedCheck) {
                abort(422, "Ce lit n'existe pas dans votre établissement.");
            }
        }

        $admission = DB::transaction(function () use ($facility, $patient, $bedId, $consultation, $data, $request) {
            $alreadyAdmitted = Admission::inFacility($facility)
                ->where('patient_id', $patient->id)
                ->where('status', 'admitted')
                ->exists();

            if ($alreadyAdmitted) {
                abort(422, 'Ce patient possède déjà une admission active.');
            }

            if ($bedId !== null) {
                $bed = Bed::inFacility($facility)->whereKey($bedId)->lockForUpdate()->first();
                if (! $bed || ! $bed->is_active) {
                    abort(422, 'Ce lit est inactif ou introuvable.');
                }
                if ($bed->status !== 'available') {
                    abort(422, "Ce lit n'est pas disponible (statut : ".$bed->status.').');
                }
                $bed->status = 'occupied';
                $bed->save();
            }

            return Admission::create([
                'facility_id' => $facility->id,
                'patient_id' => $patient->id,
                'bed_id' => $bedId,
                'consultation_id' => $consultation?->id,
                'admitted_by' => $request->user()?->id,
                'status' => 'admitted',
                'reason' => $data['reason'] ?? null,
                'notes' => $data['notes'] ?? null,
                'admitted_at' => $data['admitted_at'] ?? now(),
            ]);
        });

        $admission->load([
            'patient:id,local_code,first_name,last_name',
            'bed:id,ward,room_number,code,status',
            'admitter:id,name',
            'discharger:id,name',
        ]);

        return response()->json(['admission' => $this->payload($admission)], 201);
    }

    public function discharge(DischargeAdmissionRequest $request, int $admissionId): JsonResponse
    {
        $facility = $this->facility($request);
        $admission = Admission::inFacility($facility)->findOrFail($admissionId);
        $this->authorize('update', $admission);

        if ($admission->status !== 'admitted') {
            abort(422, 'Seule une admission active peut faire l\'objet d\'une sortie.');
        }

        $data = $request->validated();
        $createInvoice = ! empty($data['create_invoice']);
        $dailyRate = isset($data['daily_rate']) ? (int) $data['daily_rate'] : 0;

        if ($createInvoice && $dailyRate <= 0) {
            abort(422, 'La facturation du séjour requiert un tarif journalier supérieur à 0 XOF.');
        }

        $createdInvoice = DB::transaction(function () use ($facility, $admission, $data, $createInvoice, $dailyRate, $request) {
            $locked = Admission::inFacility($facility)->whereKey($admission->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'admitted') {
                abort(422, 'Cette admission a déjà été clôturée.');
            }

            $dischargedAt = isset($data['discharged_at']) ? Carbon::parse((string) $data['discharged_at']) : now();
            $locked->status = 'discharged';
            $locked->discharged_at = $dischargedAt;
            $locked->discharged_by = $request->user()?->id;
            if (array_key_exists('notes', $data)) {
                $locked->notes = $data['notes'];
            }
            $locked->save();

            if ($locked->bed_id !== null) {
                $bed = Bed::inFacility($facility)->whereKey($locked->bed_id)->lockForUpdate()->first();
                if ($bed && $bed->status === 'occupied') {
                    $bed->status = $data['bed_status'] ?? 'available';
                    $bed->save();
                }
            }

            if (! $createInvoice) {
                return null;
            }

            $admittedAt = $locked->admitted_at;
            $diffHours = max(1, (int) ceil($admittedAt->diffInMinutes($dischargedAt) / 60));
            $days = max(1, (int) ceil($diffHours / 24));
            $amount = $days * $dailyRate;

            $inv = Invoice::create([
                'facility_id' => $facility->id,
                'patient_id' => $locked->patient_id,
                'consultation_id' => $locked->consultation_id,
                'created_by' => $request->user()?->id,
                'number' => 'TMP-'.uniqid(),
                'status' => 'draft',
                'total_amount' => $amount,
                'due_date' => $data['invoice_due_date'] ?? null,
            ]);

            $inv->number = 'FAC-'.str_pad((string) $inv->id, 5, '0', STR_PAD_LEFT);
            $inv->save();

            InvoiceItem::create([
                'invoice_id' => $inv->id,
                'admission_id' => $locked->id,
                'label' => 'Séjour hospitalier ('.$days.' j)',
                'quantity' => $days,
                'unit_price' => $dailyRate,
                'amount' => $amount,
            ]);

            return $inv;
        });

        $fresh = Admission::inFacility($facility)->with([
            'patient:id,local_code,first_name,last_name',
            'bed:id,ward,room_number,code,status',
            'admitter:id,name',
            'discharger:id,name',
        ])->findOrFail($admission->id);

        $response = ['admission' => $this->payload($fresh)];
        if ($createdInvoice instanceof Invoice) {
            $response['invoice'] = [
                'id' => $createdInvoice->id,
                'number' => $createdInvoice->number,
                'status' => $createdInvoice->status,
                'total_amount' => (int) $createdInvoice->total_amount,
            ];
        }

        return response()->json($response);
    }

    public function cancel(CancelAdmissionRequest $request, int $admissionId): JsonResponse
    {
        $facility = $this->facility($request);
        $admission = Admission::inFacility($facility)->findOrFail($admissionId);
        $this->authorize('update', $admission);

        if ($admission->status !== 'admitted') {
            abort(422, 'Seule une admission active peut être annulée.');
        }

        $data = $request->validated();

        DB::transaction(function () use ($facility, $admission, $data) {
            $locked = Admission::inFacility($facility)->whereKey($admission->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'admitted') {
                abort(422, 'Cette admission n\'est plus active.');
            }

            $locked->status = 'cancelled';
            if (! empty($data['reason'])) {
                $prefix = $locked->notes ? $locked->notes."\n" : '';
                $locked->notes = $prefix.'Annulation : '.$data['reason'];
            }
            $locked->save();

            if ($locked->bed_id !== null) {
                $bed = Bed::inFacility($facility)->whereKey($locked->bed_id)->lockForUpdate()->first();
                if ($bed && $bed->status === 'occupied') {
                    $bed->status = $data['bed_status'] ?? 'available';
                    $bed->save();
                }
            }
        });

        $fresh = Admission::inFacility($facility)->with([
            'patient:id,local_code,first_name,last_name',
            'bed:id,ward,room_number,code,status',
            'admitter:id,name',
            'discharger:id,name',
        ])->findOrFail($admission->id);

        return response()->json(['admission' => $this->payload($fresh)]);
    }

    private function payload(Admission $a): array
    {
        return [
            'id' => $a->id,
            'status' => $a->status,
            'patient' => [
                'id' => $a->patient->id,
                'local_code' => $a->patient->local_code,
                'first_name' => $a->patient->first_name,
                'last_name' => $a->patient->last_name,
            ],
            'bed' => $a->bed ? [
                'id' => $a->bed->id,
                'ward' => $a->bed->ward,
                'room_number' => $a->bed->room_number,
                'code' => $a->bed->code,
                'status' => $a->bed->status,
            ] : null,
            'consultation_id' => $a->consultation_id,
            'reason' => $a->reason,
            'notes' => $a->notes,
            'admitted_by' => $a->admitter?->name,
            'discharged_by' => $a->discharger?->name,
            'admitted_at' => $a->admitted_at->format('Y-m-d H:i'),
            'discharged_at' => $a->discharged_at?->format('Y-m-d H:i'),
        ];
    }
}
