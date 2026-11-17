<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Facility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Trait à inclure dans chaque contrôleur métier.
 * Fournit facility() et un helper pour les réponses JSON d'erreur uniformes.
 */
trait ResolvesFacility
{
    protected function facility(Request $request): Facility
    {
        $facility = $request->attributes->get('facility');

        if (! $facility instanceof Facility) {
            // Fallback : si le middleware n'est pas monté, on résout manuellement
            $facility = $request->user()?->currentFacility;

            if (! $facility) {
                abort(409, 'Aucun établissement actif. Choisissez-en un dans Établissements.');
            }

            if (! $facility->is_active) {
                abort(403, 'Votre établissement actif est désactivé.');
            }
        }

        // PHPStan : currentFacility() retourne Model, on assert le type réel
        assert($facility instanceof Facility);

        return $facility;
    }

    protected function jsonError(int $status, string $code, string $message): JsonResponse
    {
        return response()->json([
            'error' => ['code' => $code, 'message' => $message],
        ], $status);
    }
}
