#!/usr/bin/env node
// HOSPIFLOW — M05 (3/4) : webapp Vue — page Consultations
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

// --- Page Consultations ---
  writeFile(
    path.join(WEB, 'src', 'views', 'ConsultationsView.vue'),
    String.raw`<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const consultations = ref([]);
const patients = ref([]);
const appointments = ref([]);
const error = ref('');

const filterPatientId = ref('');

const patientId = ref('');
const appointmentId = ref('');
const chiefComplaint = ref('');
const examination = ref('');
const diagnosis = ref('');
const treatment = ref('');
const followUpDate = ref('');

async function loadConsultations() {
  error.value = '';
  try {
    const suffix = filterPatientId.value
      ? '?patient_id=' + filterPatientId.value
      : '';
    const data = await api('/consultations' + suffix, { token: auth.token });
    consultations.value = data.consultations;
  } catch (exception) {
    error.value = exception.message;
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
    const appointmentsData = await api('/appointments', { token: auth.token });
    appointments.value = appointmentsData.appointments;
  } catch (exception) {
    error.value = exception.message;
  }
}

async function createConsultation() {
  error.value = '';
  try {
    await api('/consultations', {
      method: 'POST',
      token: auth.token,
      body: {
        patient_id: Number(patientId.value),
        appointment_id: appointmentId.value ? Number(appointmentId.value) : null,
        chief_complaint: chiefComplaint.value.trim(),
        examination: examination.value.trim() || null,
        diagnosis: diagnosis.value.trim() || null,
        treatment: treatment.value.trim() || null,
        follow_up_date: followUpDate.value || null,
      },
    });
    patientId.value = '';
    appointmentId.value = '';
    chiefComplaint.value = '';
    examination.value = '';
    diagnosis.value = '';
    treatment.value = '';
    followUpDate.value = '';
    await loadConsultations();
  } catch (exception) {
    error.value = exception.message;
  }
}

onMounted(async () => {
  await loadReferences();
  await loadConsultations();
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
        <router-link to="/facilities">Établissements</router-link>
      </nav>
    </header>

<section class="content">
      <h1>Consultations</h1>

<p v-if="error" class="error">{{ error }}</p>

<form class="filters" @submit.prevent="loadConsultations">
        <label>
          Historique du patient
          <select v-model="filterPatientId">
            <option value="">Tous les patients</option>
            <option v-for="patient in patients" :key="patient.id" :value="patient.id">
              {{ patient.last_name }} {{ patient.first_name }} ({{ patient.local_code }})
            </option>
          </select>
        </label>
        <button type="submit">Afficher</button>
      </form>

<table v-if="consultations.length">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Praticien</th>
            <th>Motif</th>
            <th>Diagnostic</th>
            <th>Suivi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="consultation in consultations" :key="consultation.id">
            <td>{{ consultation.created_at }}</td>
            <td>
              {{ consultation.patient.last_name }} {{ consultation.patient.first_name }}
              <br />
              <small>{{ consultation.patient.local_code }}</small>
            </td>
            <td>{{ consultation.practitioner.name }}</td>
            <td>{{ consultation.chief_complaint }}</td>
            <td>{{ consultation.diagnosis || '—' }}</td>
            <td>{{ consultation.follow_up_date || '—' }}</td>
          </tr>
        </tbody>
      </table>

<p v-else>Aucune consultation enregistrée.</p>

<form class="create" @submit.prevent="createConsultation">
        <h2>Nouvelle consultation</h2>

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
          Rendez-vous lié (optionnel)
          <select v-model="appointmentId">
            <option value="">Aucun</option>
            <option v-for="appointment in appointments" :key="appointment.id" :value="appointment.id">
              {{ appointment.scheduled_at }} — {{ appointment.patient.last_name }}
            </option>
          </select>
        </label>

<label>
          Motif de consultation
          <input v-model="chiefComplaint" required placeholder="Douleurs abdominales…" />
        </label>

<label>
          Examen clinique
          <textarea v-model="examination" rows="3"></textarea>
        </label>

<label>
          Diagnostic
          <input v-model="diagnosis" placeholder="Suspicion d'appendicite aiguë" />
        </label>

<label>
          Traitement / conduite à tenir
          <textarea v-model="treatment" rows="3"></textarea>
        </label>

<label>
          Date de suivi
          <input v-model="followUpDate" type="date" />
        </label>

<button type="submit">Enregistrer le compte-rendu</button>
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
.create { margin-top: 2rem; display: grid; gap: .6rem; max-width: 520px; background: #fff; padding: 1.5rem; border-radius: 8px; }
.create h2 { margin: 0 0 .3rem; font-size: 1.1rem; }
label { display: grid; gap: .25rem; font-size: .9rem; }
input, select, textarea { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: .95rem; font-family: inherit; }
.create button { padding: .6rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
</style>
`
  );

// --- Tableau de bord : lien Consultations ---
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
nav { display: flex; align-items: center; gap: 1rem; }
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
