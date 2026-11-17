<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Résout la facility courante depuis l'utilisateur authentifié et l'expose.
 * Placé APRÈS EnsureFacilityIsActive dans la pile (qui garantit sa présence).
 */
class ResolveFacility
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->attributes->has('facility')) {
            $facility = $request->user()?->currentFacility;

            if ($facility) {
                $request->attributes->set('facility', $facility);
            }
        }

        return $next($request);
    }
}
