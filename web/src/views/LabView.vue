<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const labRequests = ref([]);
const patients = ref([]);
const error = ref('');

const filterPatientId = ref('');
const filterStatus = ref('');

const patientId = ref('');
const panel = ref('');
const priority = ref('routine');
const notes = ref('');

const resultTargetId = ref(null);
const resultValues = ref('');
const resultConclusion = ref('');

const STATUS_LABELS = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Complétée',
  cancelled: 'Annulée',
};

async function loadLabRequests() {
  error.value = '';
  try {
    const params = new URLSearchParams();

if (filterPatientId.value) params.set('patient_id', filterPatientId.value);
    if (filterStatus.value) params.set('status', filterStatus.value);

const suffix = params.toString() ? '?' + params.toString() : '';
    const data = await api('/lab-requests' + suffix, { token: auth.token });
    labRequests.value = data.lab_requests;
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

async function createRequest() {
  error.value = '';
  try {
    await api('/lab-requests', {
      method: 'POST',
      token: auth.token,
      body: {
        patient_id: Number(patientId.value),
        panel: panel.value.trim(),
        priority: priority.value,
        notes: notes.value.trim() || null,
      },
    });
    patientId.value = '';
    panel.value = '';
    priority.value = 'routine';
    notes.value = '';
    await loadLabRequests();
  } catch (exception) {
    error.value = exception.message;
  }
}

async function setStatus(requestId, status) {
  error.value = '';
  try {
    await api('/lab-requests/' + requestId, {
      method: 'PATCH',
      token: auth.token,
      body: { status },
    });
    await loadLabRequests();
  } catch (exception) {
    error.value = exception.message;
  }
}

function openResultForm(requestId) {
  resultTargetId.value = requestId;
  resultValues.value = '';
  resultConclusion.value = '';
}

async function submitResult() {
  error.value = '';
  try {
    await api('/lab-requests/' + resultTargetId.value + '/result', {
      method: 'POST',
      token: auth.token,
      body: {
        values: resultValues.value.trim(),
        conclusion: resultConclusion.value.trim() || null,
      },
    });
    resultTargetId.value = null;
    await loadLabRequests();
  } catch (exception) {
    error.value = exception.message;
  }
}

onMounted(async () => {
  await loadPatients();
  await loadLabRequests();
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
        <router-link to="/facilities">Établissements</router-link>
      </nav>
    </header>

<section class="content">
      <h1>Laboratoire</h1>

<p v-if="error" class="error">{{ error }}</p>

<form class="filters" @submit.prevent="loadLabRequests">
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
            <option value="pending">En attente</option>
            <option value="in_progress">En cours</option>
            <option value="completed">Complétée</option>
            <option value="cancelled">Annulée</option>
          </select>
        </label>
        <button type="submit">Afficher</button>
      </form>

<table v-if="labRequests.length">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Analyse</th>
            <th>Prescrit par</th>
            <th>Priorité</th>
            <th>Statut</th>
            <th>Résultat</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="labRequest in labRequests" :key="labRequest.id">
            <td>{{ labRequest.created_at }}</td>
            <td>
              {{ labRequest.patient.last_name }} {{ labRequest.patient.first_name }}
              <br />
              <small>{{ labRequest.patient.local_code }}</small>
            </td>
            <td>{{ labRequest.panel }}</td>
            <td>{{ labRequest.requested_by }}</td>
            <td>
              <span class="badge" :class="labRequest.priority">
                {{ labRequest.priority === 'urgent' ? 'Urgent' : 'Routine' }}
              </span>
            </td>
            <td>
              <span class="badge" :class="labRequest.status">
                {{ STATUS_LABELS[labRequest.status] || labRequest.status }}
              </span>
            </td>
            <td>
              <template v-if="labRequest.result">
                {{ labRequest.result.conclusion || 'Saisi' }}
                <br />
                <small>{{ labRequest.result.resulted_at }} — {{ labRequest.result.resulted_by }}</small>
              </template>
              <template v-else>—</template>
            </td>
            <td class="actions">
              <button
                v-if="labRequest.status === 'pending'"
                @click="setStatus(labRequest.id, 'in_progress')"
              >
                Prendre en charge
              </button>
              <button
                v-if="labRequest.status === 'pending' || labRequest.status === 'in_progress'"
                @click="openResultForm(labRequest.id)"
              >
                Saisir résultat
              </button>
              <button
                v-if="labRequest.status === 'pending' || labRequest.status === 'in_progress'"
                @click="setStatus(labRequest.id, 'cancelled')"
              >
                Annuler
              </button>
            </td>
          </tr>
        </tbody>
      </table>

<p v-else>Aucune demande d'analyse.</p>

<form
        v-if="resultTargetId !== null"
        class="create"
        @submit.prevent="submitResult"
      >
        <h2>Saisie du résultat (demande #{{ resultTargetId }})</h2>

<label>
          Valeurs
          <textarea
            v-model="resultValues"
            rows="4"
            required
            placeholder="Hb : 13,4 g/dL&#10;GB : 7 800/mm³&#10;CRP : 4 mg/L"
          ></textarea>
        </label>

<label>
          Conclusion
          <input v-model="resultConclusion" placeholder="Bilan normal" />
        </label>

<button type="submit">Valider le résultat</button>
        <button type="button" class="secondary" @click="resultTargetId = null">
          Annuler
        </button>
      </form>

<form class="create" @submit.prevent="createRequest">
        <h2>Nouvelle demande d'analyse</h2>

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
          Type d'analyse
          <input v-model="panel" required placeholder="NFS, glycémie, CRP…" />
        </label>

<label>
          Priorité
          <select v-model="priority">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>

<label>
          Notes
          <input v-model="notes" placeholder="Contexte clinique éventuel" />
        </label>

<button type="submit">Prescrire</button>
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
.content { padding: 2rem; max-width: 1100px; }
.error { color: #dc2626; }
.filters { display: flex; gap: .8rem; align-items: end; margin-bottom: 1.2rem; }
.filters label { display: grid; gap: .25rem; font-size: .9rem; }
.filters button { padding: .5rem 1rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; }
th, td { padding: .55rem .8rem; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: .9rem; }
th { background: #f3f4f6; }
.badge { padding: .15rem .6rem; border-radius: 999px; font-size: .8rem; background: #e5e7eb; color: #374151; }
.badge.urgent { background: #fee2e2; color: #991b1b; }
.badge.pending { background: #e0e7ff; color: #3730a3; }
.badge.in_progress { background: #fef3c7; color: #92400e; }
.badge.completed { background: #dcfce7; color: #166534; }
.badge.cancelled { background: #f3f4f6; color: #6b7280; }
.actions { display: flex; gap: .35rem; flex-wrap: wrap; }
.actions button { padding: .25rem .55rem; border: 0; border-radius: 6px; background: #0d6efd; color: #fff; cursor: pointer; font-size: .78rem; }
.create { margin-top: 2rem; display: grid; gap: .6rem; max-width: 520px; background: #fff; padding: 1.5rem; border-radius: 8px; }
.create h2 { margin: 0 0 .3rem; font-size: 1.1rem; }
label { display: grid; gap: .25rem; font-size: .9rem; }
input, select, textarea { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: .95rem; font-family: inherit; }
.create button { padding: .6rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
.create button.secondary { background: #6b7280; }
</style>
