#!/usr/bin/env node
// HOSPIFLOW — M08 (3/4) : webapp Vue — page Facturation
import path from 'node:path';
import { WEB, ok, writeFile } from './helpers.mjs';

export function installFrontend() {
  // --- Routeur ---
  writeFile(
    path.join(WEB, 'src', 'router', 'index.js'),
    String.raw`import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
    {
      path: '/',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/facilities',
      component: () => import('../views/FacilitiesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/patients',
      component: () => import('../views/PatientsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/appointments',
      component: () => import('../views/AppointmentsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/consultations',
      component: () => import('../views/ConsultationsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/laboratoire',
      component: () => import('../views/LabView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pharmacie',
      component: () => import('../views/PharmacyView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/facturation',
      component: () => import('../views/BillingView.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return '/login';
  }

if (to.path === '/login' && auth.isAuthenticated) {
    return '/';
  }
});

export default router;
`
  );

// --- Page Facturation ---
  writeFile(
    path.join(WEB, 'src', 'views', 'BillingView.vue'),
    String.raw`<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const invoices = ref([]);
const patients = ref([]);
const error = ref('');

const filterPatientId = ref('');
const filterStatus = ref('');

const patientId = ref('');
const dueDate = ref('');
const lines = ref([{ label: '', quantity: 1, unit_price: 0 }]);

const payTarget = ref(null);
const payAmount = ref('');
const payMethod = ref('cash');

const STATUS_LABELS = {
  draft: 'Brouillon',
  issued: 'Émise',
  paid: 'Payée',
  cancelled: 'Annulée',
};

const METHOD_LABELS = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  transfer: 'Virement',
};

function addLine() {
  lines.value.push({ label: '', quantity: 1, unit_price: 0 });
}

function removeLine(index) {
  if (lines.value.length > 1) {
    lines.value.splice(index, 1);
  }
}

function formatXof(amount) {
  return Number(amount).toLocaleString('fr-FR') + ' XOF';
}

async function loadInvoices() {
  error.value = '';
  try {
    const params = new URLSearchParams();

if (filterPatientId.value) params.set('patient_id', filterPatientId.value);
    if (filterStatus.value) params.set('status', filterStatus.value);

const suffix = params.toString() ? '?' + params.toString() : '';
    const data = await api('/invoices' + suffix, { token: auth.token });
    invoices.value = data.invoices;
  } catch (exception) {
    error.value = exception.message;
  }
}

async function loadPatients() {
  try {
    const patientsData = await api('/patients', { token: auth.token });
    patients.value = patientsData.patients;
  } catch (exception) {
    error.value = exception.message;
  }
}

async function createInvoice() {
  error.value = '';
  try {
    await api('/invoices', {
      method: 'POST',
      token: auth.token,
      body: {
        patient_id: Number(patientId.value),
        due_date: dueDate.value || null,
        items: lines.value
          .filter((line) => line.label.trim() && line.quantity > 0)
          .map((line) => ({
            label: line.label.trim(),
            quantity: Number(line.quantity),
            unit_price: Number(line.unit_price),
          })),
      },
    });
    patientId.value = '';
    dueDate.value = '';
    lines.value = [{ label: '', quantity: 1, unit_price: 0 }];
    await loadInvoices();
  } catch (exception) {
    error.value = exception.message;
  }
}

async function setStatus(invoiceId, status) {
  error.value = '';
  try {
    await api('/invoices/' + invoiceId, {
      method: 'PATCH',
      token: auth.token,
      body: { status },
    });
    await loadInvoices();
  } catch (exception) {
    error.value = exception.message;
  }
}

function openPayForm(invoice) {
  payTarget.value = invoice;
  payAmount.value = invoice.remaining_amount;
  payMethod.value = 'cash';
}

async function submitPayment() {
  error.value = '';
  try {
    await api('/invoices/' + payTarget.value.id + '/payments', {
      method: 'POST',
      token: auth.token,
      body: {
        amount: Number(payAmount.value),
        method: payMethod.value,
      },
    });
    payTarget.value = null;
    await loadInvoices();
  } catch (exception) {
    error.value = exception.message;
  }
}

onMounted(async () => {
  await loadPatients();
  await loadInvoices();
});
</script>

<template>
  <main class="page">
    <header>
      <strong>HOSPIFLOW</strong>
      <nav>
        <router-link to="/">Tableau de bord</router-link>
        <router-link to="/patients">Patients</router-link>
        <router-link to="/appointments">Rendez-vous</router-link>
        <router-link to="/consultations">Consultations</router-link>
        <router-link to="/laboratoire">Laboratoire</router-link>
        <router-link to="/pharmacie">Pharmacie</router-link>
        <router-link to="/facilities">Établissements</router-link>
      </nav>
    </header>

<section class="content">
      <h1>Facturation</h1>

<p v-if="error" class="error">{{ error }}</p>

<form class="filters" @submit.prevent="loadInvoices">
        <label>
          Patient
          <select v-model="filterPatientId">
            <option value="">Tous</option>
            <option v-for="patient in patients" :key="patient.id" :value="patient.id">
              {{ patient.last_name }} {{ patient.first_name }} ({{ patient.local_code }})
            </option>
          </select>
        </label>
        <label>
          Statut
          <select v-model="filterStatus">
            <option value="">Tous</option>
            <option value="draft">Brouillon</option>
            <option value="issued">Émise</option>
            <option value="paid">Payée</option>
            <option value="cancelled">Annulée</option>
          </select>
        </label>
        <button type="submit">Afficher</button>
      </form>

<table v-if="invoices.length">
        <thead>
          <tr>
            <th>N°</th>
            <th>Date</th>
            <th>Patient</th>
            <th>Total</th>
            <th>Payé</th>
            <th>Reste</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="invoice in invoices" :key="invoice.id">
            <td>{{ invoice.number }}</td>
            <td>{{ invoice.created_at }}</td>
            <td>
              {{ invoice.patient.last_name }} {{ invoice.patient.first_name }}
              <br />
              <small>{{ invoice.patient.local_code }}</small>
            </td>
            <td>{{ formatXof(invoice.total_amount) }}</td>
            <td>{{ formatXof(invoice.paid_amount) }}</td>
            <td>{{ formatXof(invoice.remaining_amount) }}</td>
            <td>
              <span class="badge" :class="invoice.status">
                {{ STATUS_LABELS[invoice.status] || invoice.status }}
              </span>
            </td>
            <td class="actions">
              <button
                v-if="invoice.status === 'draft'"
                @click="setStatus(invoice.id, 'issued')"
              >
                Émettre
              </button>
              <button
                v-if="invoice.status === 'issued'"
                @click="openPayForm(invoice)"
              >
                Encaisser
              </button>
              <button
                v-if="invoice.status === 'draft' || invoice.status === 'issued'"
                @click="setStatus(invoice.id, 'cancelled')"
              >
                Annuler
              </button>
            </td>
          </tr>
        </tbody>
      </table>

<p v-else>Aucune facture pour ce filtre.</p>

<form v-if="payTarget" class="card" @submit.prevent="submitPayment">
        <h2>Encaissement — {{ payTarget.number }} (reste {{ formatXof(payTarget.remaining_amount) }})</h2>

<label>
          Montant (XOF)
          <input v-model="payAmount" type="number" min="1" required />
        </label>

<label>
          Mode
          <select v-model="payMethod">
            <option value="cash">Espèces</option>
            <option value="mobile_money">Mobile Money</option>
            <option value="transfer">Virement</option>
          </select>
        </label>

<button type="submit">Enregistrer le paiement</button>
        <button type="button" class="secondary" @click="payTarget = null">
          Annuler
        </button>
      </form>

<form class="card" @submit.prevent="createInvoice">
        <h2>Nouvelle facture</h2>

<label>
          Patient
          <select v-model="patientId" required>
            <option value="" disabled>— Choisir un patient —</option>
            <option v-for="patient in patients" :key="patient.id" :value="patient.id">
              {{ patient.last_name }} {{ patient.first_name }} ({{ patient.local_code }})
            </option>
          </select>
        </label>

<label>
          Échéance
          <input v-model="dueDate" type="date" />
        </label>

<fieldset class="lines">
          <legend>Lignes de facture</legend>

<div v-for="(line, index) in lines" :key="index" class="line">
            <label class="grow">
              Libellé
              <input v-model="line.label" placeholder="Consultation générale" />
            </label>
            <label>
              Qté
              <input v-model="line.quantity" type="number" min="1" />
            </label>
            <label>
              Prix unitaire
              <input v-model="line.unit_price" type="number" min="0" />
            </label>
            <button type="button" class="secondary" @click="removeLine(index)">×</button>
          </div>

<button type="button" class="secondary" @click="addLine">Ajouter une ligne</button>
        </fieldset>

<button type="submit">Créer la facture</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.page { min-height: 100vh; }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
}
header strong { color: #0d6efd; letter-spacing: .05em; }
nav { display: flex; gap: 1.2rem; flex-wrap: wrap; }
nav a { color: #1f2937; text-decoration: none; }
nav a:hover { text-decoration: underline; }
.content { padding: 2rem; max-width: 1200px; }
.error { color: #dc2626; }
.filters { display: flex; gap: .8rem; align-items: end; margin-bottom: 1.2rem; }
.filters label { display: grid; gap: .25rem; font-size: .9rem; }
.filters button { padding: .5rem 1rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; }
th, td { padding: .55rem .8rem; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: .9rem; }
th { background: #f3f4f6; }
.badge { padding: .15rem .6rem; border-radius: 999px; font-size: .8rem; background: #e5e7eb; color: #374151; }
.badge.draft { background: #f3f4f6; color: #6b7280; }
.badge.issued { background: #e0e7ff; color: #3730a3; }
.badge.paid { background: #dcfce7; color: #166534; }
.badge.cancelled { background: #fee2e2; color: #991b1b; }
.actions { display: flex; gap: .35rem; flex-wrap: wrap; }
.actions button { padding: .25rem .55rem; border: 0; border-radius: 6px; background: #0d6efd; color: #fff; cursor: pointer; font-size: .78rem; }
.card { margin-top: 2rem; display: grid; gap: .6rem; max-width: 640px; background: #fff; padding: 1.5rem; border-radius: 8px; }
.card h2 { margin: 0 0 .3rem; font-size: 1.1rem; }
label { display: grid; gap: .25rem; font-size: .9rem; }
input, select { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: .95rem; }
.lines { border: 1px solid #e5e7eb; border-radius: 8px; padding: .8rem; display: grid; gap: .5rem; }
.lines legend { font-size: .9rem; padding: 0 .4rem; }
.line { display: grid; grid-template-columns: 1fr 90px 130px auto; gap: .5rem; align-items: end; }
.line .grow { grid-column: 1 / 2; }
.card button { padding: .6rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
.card button.secondary { background: #6b7280; }
</style>
`
  );

// --- Tableau de bord : lien Facturation ---
  writeFile(
    path.join(WEB, 'src', 'views', 'DashboardView.vue'),
    String.raw`<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const currentFacilityName = ref('');

async function logout() {
  await auth.logout();
  await router.push('/login');
}

onMounted(async () => {
  try {
    const facilities = await auth.loadFacilities();
    const current = facilities.find(
      (facility) => facility.id === auth.currentFacilityId
    );
    currentFacilityName.value = current ? current.name : '';
  } catch {
    currentFacilityName.value = '';
  }
});
</script>

<template>
  <main class="dash">
    <header>
      <strong>HOSPIFLOW</strong>
      <nav>
        <router-link to="/patients">Patients</router-link>
        <router-link to="/appointments">Rendez-vous</router-link>
        <router-link to="/consultations">Consultations</router-link>
        <router-link to="/laboratoire">Laboratoire</router-link>
        <router-link to="/pharmacie">Pharmacie</router-link>
        <router-link to="/facturation">Facturation</router-link>
        <router-link to="/facilities">Établissements</router-link>
        <span>{{ auth.user?.name }}</span>
        <button @click="logout">Déconnexion</button>
      </nav>
    </header>

<section class="content">
      <h1>Bienvenue, {{ auth.user?.name }}</h1>
      <p>
        Rôles :
        <span v-for="role in auth.roles" :key="role" class="badge">{{ role }}</span>
      </p>
      <p v-if="currentFacilityName">
        Établissement actif : <strong>{{ currentFacilityName }}</strong>
      </p>
    </section>
  </main>
</template>

<style scoped>
.dash { min-height: 100vh; }
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
}
header strong { color: #0d6efd; letter-spacing: .05em; }
nav { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
nav a { color: #1f2937; text-decoration: none; }
nav a:hover { text-decoration: underline; }
nav button { padding: .4rem .9rem; border: 0; border-radius: 8px; background: #ef4444; color: #fff; cursor: pointer; }
.content { padding: 2rem; }
.badge { display: inline-block; margin-right: .4rem; padding: .15rem .6rem; border-radius: 999px; background: #e0e7ff; color: #3730a3; font-size: .85rem; }
</style>
`
  );

ok('Fichiers frontend écrits');
}
