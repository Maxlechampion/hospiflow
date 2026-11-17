<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->can('billing.view');
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $user->can('billing.view')
            && $user->current_facility_id === $invoice->facility_id;
    }

    public function create(User $user): bool
    {
        return $user->can('billing.manage');
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->can('billing.manage')
            && $user->current_facility_id === $invoice->facility_id
            && in_array($invoice->status, ['draft', 'issued'], true);
    }

    public function pay(User $user, Invoice $invoice): bool
    {
        return $user->can('billing.manage')
            && $user->current_facility_id === $invoice->facility_id
            && $invoice->status === 'issued';
    }

    public function cancel(User $user, Invoice $invoice): bool
    {
        return $user->can('billing.manage')
            && $user->current_facility_id === $invoice->facility_id
            && in_array($invoice->status, ['draft', 'issued'], true)
            && $invoice->payments()->sum('amount') === 0;
    }
}
