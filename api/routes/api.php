<?php

use App\Http\Controllers\AdmissionController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\AuditLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BedController;
use App\Http\Controllers\ConsultationController;
use App\Http\Controllers\FacilityController;
use App\Http\Controllers\InvoiceController;
use App\Http\Controllers\LabPanelController;
use App\Http\Controllers\LabRequestController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\PharmacyController;
use App\Http\Controllers\PrescriptionController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

// --- Public ---
Route::get('/health', fn () => response()->json(['status' => 'ok']));

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:5,1');

// --- Authentifié (Sanctum) ---
Route::middleware('auth:sanctum')->group(function () {

    // Auth (pas de facility requise)
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Établissements (pas de facility active requise — on peut switcher)
    Route::get('/facilities', [FacilityController::class, 'index']);
    Route::post('/facilities', [FacilityController::class, 'store']);
    Route::patch('/facilities/{facility}', [FacilityController::class, 'update']);
    Route::post('/facilities/{facility}/switch', [FacilityController::class, 'switch']);
    Route::post('/facilities/{facility}/users', [FacilityController::class, 'attachUser']);
    Route::get('/facilities/{facility}/users', [FacilityController::class, 'users']);
    Route::delete('/facilities/{facility}/users/{userId}', [FacilityController::class, 'detachUser']);

    // --- Routes métier (facility active requise) ---
    Route::middleware('facility.active')->group(function () {

        // Patients
        Route::get('/patients', [PatientController::class, 'index']);
        Route::post('/patients', [PatientController::class, 'store']);
        Route::get('/patients/search', [PatientController::class, 'search']);
        Route::get('/patients/{patientId}', [PatientController::class, 'show']);
        Route::patch('/patients/{patientId}', [PatientController::class, 'update']);

        // Rendez-vous
        Route::get('/appointments', [AppointmentController::class, 'index']);
        Route::post('/appointments', [AppointmentController::class, 'store']);
        Route::get('/appointments/practitioners', [AppointmentController::class, 'practitioners']);
        Route::get('/appointments/{appointmentId}', [AppointmentController::class, 'show']);
        Route::patch('/appointments/{appointmentId}', [AppointmentController::class, 'update']);

        // Consultations
        Route::get('/consultations', [ConsultationController::class, 'index']);
        Route::post('/consultations', [ConsultationController::class, 'store']);
        Route::get('/consultations/{consultationId}', [ConsultationController::class, 'show']);
        Route::patch('/consultations/{consultationId}', [ConsultationController::class, 'update']);

        // Laboratoire & Catalogue Panels
        Route::get('/lab-panels', [LabPanelController::class, 'index']);
        Route::post('/lab-panels', [LabPanelController::class, 'store']);
        Route::patch('/lab-panels/{labPanelId}', [LabPanelController::class, 'update']);
        Route::get('/lab-requests', [LabRequestController::class, 'index']);
        Route::post('/lab-requests', [LabRequestController::class, 'store']);
        Route::get('/lab-requests/{labRequestId}', [LabRequestController::class, 'show']);
        Route::patch('/lab-requests/{labRequestId}', [LabRequestController::class, 'update']);
        Route::post('/lab-requests/{labRequestId}/result', [LabRequestController::class, 'storeResult']);

        // Pharmacie
        Route::get('/pharmacy/drugs', [PharmacyController::class, 'drugs']);
        Route::post('/pharmacy/drugs', [PharmacyController::class, 'storeDrug']);
        Route::get('/pharmacy/stock', [PharmacyController::class, 'stock']);
        Route::post('/pharmacy/stock', [PharmacyController::class, 'storeStock']);
        Route::get('/pharmacy/dispensations', [PharmacyController::class, 'dispensations']);
        Route::post('/pharmacy/dispensations', [PharmacyController::class, 'dispense']);
        Route::get('/pharmacy/dispensations/{dispensationId}', [PharmacyController::class, 'showDispensation']);

        // Prescriptions
        Route::get('/prescriptions', [PrescriptionController::class, 'index']);
        Route::post('/prescriptions', [PrescriptionController::class, 'store']);
        Route::get('/prescriptions/{prescriptionId}', [PrescriptionController::class, 'show']);
        Route::patch('/prescriptions/{prescriptionId}', [PrescriptionController::class, 'update']);
        Route::delete('/prescriptions/{prescriptionId}', [PrescriptionController::class, 'destroy']);
        Route::post('/prescriptions/{prescriptionId}/items', [PrescriptionController::class, 'addItem']);
        Route::delete('/prescriptions/{prescriptionId}/items/{itemId}', [PrescriptionController::class, 'removeItem']);

        // Admissions & Lits
        Route::get('/beds', [BedController::class, 'index']);
        Route::post('/beds', [BedController::class, 'store']);
        Route::patch('/beds/{bedId}', [BedController::class, 'update']);
        Route::get('/admissions', [AdmissionController::class, 'index']);
        Route::post('/admissions', [AdmissionController::class, 'store']);
        Route::get('/admissions/{admissionId}', [AdmissionController::class, 'show']);
        Route::post('/admissions/{admissionId}/discharge', [AdmissionController::class, 'discharge']);
        Route::post('/admissions/{admissionId}/cancel', [AdmissionController::class, 'cancel']);

        // Facturation
        Route::get('/invoices', [InvoiceController::class, 'index']);
        Route::post('/invoices', [InvoiceController::class, 'store']);
        Route::get('/invoices/{invoiceId}', [InvoiceController::class, 'show']);
        Route::patch('/invoices/{invoiceId}', [InvoiceController::class, 'update']);
        Route::post('/invoices/{invoiceId}/payments', [InvoiceController::class, 'pay']);

        // Audit logs (Vague 2 - Lot B)
        Route::get('/audit-logs', [AuditLogController::class, 'index']);

        // Rapports
        Route::get('/reports/overview', [ReportController::class, 'overview']);
        Route::get('/reports/revenue', [ReportController::class, 'revenue']);
        Route::get('/reports/stock', [ReportController::class, 'stock']);
        Route::get('/reports/export', [ReportController::class, 'export']); //
    });
});
