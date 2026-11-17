#!/usr/bin/env node
// HOSPIFLOW — M04 (3/4) : webapp Vue — page Rendez-vous
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

// --- Page Rendez-vous ---
  writeFile(
    path.join(WEB, 'src', 'views', 'AppointmentsView.vue'),
    String.raw`<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const appointments = ref([]);
const patients = ref([]);
const practitioners = ref([]);
const error = ref('');
const loading = ref(false);

const today = new Date().toISOString().slice(0, 10);
const filterDate = ref(today);

const patientId = ref('');
const practitionerId = ref('');
const scheduledAt = ref('');
const durationMinutes = ref(30);
const reason = ref('');

const STATUS_LABELS = {
  scheduled: 'Planifié',
  confirmed: 'Confirmé',
  done: 'Réalisé',
  cancelled: 'Annulé',
  no_show: 'Absent',
};

async function loadAppointments() {
  loading.value = true;
  error.value = '';
  try {
    const params = filterDate.value
      ? '?date=' + encodeURIComponent(filterDate.value)
      : '';
    const data = await api('/appointments' + params, { token: auth.token });
    appointments.value = data.appointments;
  } catch (exception) {
    error.value = exception.message;
  } finally {
    loading.value = false;
  }
}

async function loadReferences() {
  try {
    const patientsData = await api('/patients', { token: auth.token });
    patients.value = patientsData.patients;
  } catch (exception) {
    error.value = exception.message;
  }
  try {
    const practitionersData = await api('/appointments/practitioners', {
      token: auth.token,
    });
    practitioners.value = practitionersData.practitioners;
  } catch (exception) {
    error.value = exception.message;
  }
}

async function createAppointment() {
  error.value = '';
  try {
    await api('/appointments', {
      method: 'POST',
      token: auth.token,
      body: {
        patient_id: Number(patientId.value),
        practitioner_id: Number(practitionerId.value),
        scheduled_at: scheduledAt.value,
        duration_minutes: Number(durationMinutes.value),
        reason: reason.value.trim() || null,
      },
    });
    patientId.value = '';
    practitionerId.value = '';
    scheduledAt.value = '';
    durationMinutes.value = 30;
    reason.value = '';
    await loadAppointments();
  } catch (exception) {
    error.value = exception.message;
  }
}

async function setStatus(appointmentId, status) {
  error.value = '';
  try {
    await api('/appointments/' + appointmentId, {
      method: 'PATCH',
      token: auth.token,
      body: { status },
    });
    await loadAppointments();
  } catch (exception) {
    error.value = exception.message;
  }
}

onMounted(async () => {
  await loadReferences();
  await loadAppointments();
});
</script>

<template>
  <main class="page">
    <header>
      <strong>HOSPIFLOW</strong>
      <nav>
        <router-link to="/">Tableau de bord</router-link>
        <router-link to="/patients">Patients</router-link>
        <router-link to="/facilities">Établissements</router-link>
      </nav>
    </header>

<section class="content">
      <h1>Rendez-vous</h1>

<p v-if="error" class="error">{{ error }}</p>

<form class="filters" @submit.prevent="loadAppointments">
        <label>
          Date
          <input v-model="filterDate" type="date" />
        </label>
        <button type="submit">Afficher</button>
        <button type="button" @click="filterDate = ''">Tout</button>
      </form>

<table v-if="appointments.length">
        <thead>
          <tr>
            <th>Heure</th>
            <th>Patient</th>
            <th>Praticien</th>
            <th>Motif</th>
            <th>Durée</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="appointment in appointments" :key="appointment.id">
            <td>{{ appointment.scheduled_at }}</td>
            <td>
              {{ appointment.patient.last_name }} {{ appointment.patient.first_name }}
              <br />
              <small>{{ appointment.patient.local_code }}</small>
            </td>
            <td>{{ appointment.practitioner.name }}</td>
            <td>{{ appointment.reason || '—' }}</td>
            <td>{{ appointment.duration_minutes }} min</td>
            <td>
              <span class="badge" :class="appointment.status">
                {{ STATUS_LABELS[appointment.status] || appointment.status }}
              </span>
            </td>
            <td class="actions">
              <button
                v-if="appointment.status === 'scheduled'"
                @click="setStatus(appointment.id, 'confirmed')"
              >
                Confirmer
              </button>
              <button
                v-if="appointment.status === 'confirmed'"
                @click="setStatus(appointment.id, 'done')"
              >
                Réalisé
              </button>
              <button
                v-if="appointment.status !== 'cancelled'"
                @click="setStatus(appointment.id, 'cancelled')"
              >
                Annuler
              </button>
            </td>
          </tr>
        </tbody>
      </table>

<p v-else-if="!loading">Aucun rendez-vous pour cette date.</p>

<form class="create" @submit.prevent="createAppointment">
        <h2>Nouveau rendez-vous</h2>

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
          Praticien
          <select v-model="practitionerId" required>
            <option value="" disabled>— Choisir un praticien —</option>
            <option
              v-for="practitioner in practitioners"
              :key="practitioner.id"
              :value="practitioner.id"
            >
              {{ practitioner.name }}
            </option>
          </select>
        </label>

<label>
          Date et heure
          <input v-model="scheduledAt" type="datetime-local" required />
        </label>

<label>
          Durée (minutes)
          <input v-model="durationMinutes" type="number" min="5" max="480" step="5" />
        </label>

<label>
          Motif
          <input v-model="reason" placeholder="Consultation générale…" />
        </label>

<button type="submit">Enregistrer</button>
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
nav { display: flex; gap: 1.2rem; }
nav a { color: #1f2937; text-decoration: none; }
nav a:hover { text-decoration: underline; }
.content { padding: 2rem; max-width: 1000px; }
.error { color: #dc2626; }
.filters { display: flex; gap: .8rem; align-items: end; margin-bottom: 1.2rem; }
.filters label { display: grid; gap: .25rem; font-size: .9rem; }
.filters button { padding: .5rem 1rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; }
th, td { padding: .55rem .8rem; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: .9rem; }
th { background: #f3f4f6; }
.badge { padding: .15rem .6rem; border-radius: 999px; font-size: .8rem; background: #e5e7eb; color: #374151; }
.badge.scheduled { background: #e0e7ff; color: #3730a3; }
.badge.confirmed { background: #dcfce7; color: #166534; }
.badge.done { background: #d1fae5; color: #065f46; }
.badge.cancelled { background: #fee2e2; color: #991b1b; }
.badge.no_show { background: #fef3c7; color: #92400e; }
.actions { display: flex; gap: .35rem; flex-wrap: wrap; }
.actions button { padding: .25rem .55rem; border: 0; border-radius: 6px; background: #0d6efd; color: #fff; cursor: pointer; font-size: .78rem; }
.create { margin-top: 2rem; display: grid; gap: .6rem; max-width: 460px; background: #fff; padding: 1.5rem; border-radius: 8px; }
.create h2 { margin: 0 0 .3rem; font-size: 1.1rem; }
label { display: grid; gap: .25rem; font-size: .9rem; }
input, select { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: .95rem; }
.create button { padding: .6rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
</style>
`
  );

// --- Tableau de bord : lien Rendez-vous ---
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
      <p class="muted">Module suivant : M05 — consultations & suivi clinique.</p>
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
nav { display: flex; align-items: center; gap: 1rem; }
nav a { color: #1f2937; text-decoration: none; }
nav a:hover { text-decoration: underline; }
nav button { padding: .4rem .9rem; border: 0; border-radius: 8px; background: #ef4444; color: #fff; cursor: pointer; }
.content { padding: 2rem; }
.badge { display: inline-block; margin-right: .4rem; padding: .15rem .6rem; border-radius: 999px; background: #e0e7ff; color: #3730a3; font-size: .85rem; }
.muted { color: #6b7280; }
</style>
`
  );

ok('Fichiers frontend écrits');
}
