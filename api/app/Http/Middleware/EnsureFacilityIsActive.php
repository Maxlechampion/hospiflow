<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Vérifie que l'utilisateur a un établissement actif avant chaque requête métier.
 * Remplace les duplications de currentFacility() dans les contrôleurs.
 *
 * Usage dans les routes :
 *   Route::middleware(['auth:sanctum', 'facility.active'])->group(...)
 */
class EnsureFacilityIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return $this->jsonError(401, 'auth.unauthenticated', 'Non authentifié.');
        }

        $facility = $user->currentFacility;

        if (! $facility) {
            return $this->jsonError(
                409,
                'facility.none_active',
                'Aucun établissement actif. Choisissez-en un dans Établissements.'
            );
        }

        if (! $facility->is_active) {
            return $this->jsonError(
                403,
                'facility.inactive',
                'Votre établissement actif est désactivé.'
            );
        }

        // Expose la facility sur la request pour les contrôleurs
        $request->attributes->set('facility', $facility);

        return $next($request);
    }

    private function jsonError(int $status, string $code, string $message): Response
    {
        return response()->json([
            'error' => [
                'code' => $code,
                'message' => $message,
            ],
        ], $status);
    }
}
