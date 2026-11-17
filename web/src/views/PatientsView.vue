<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const patients = ref([]);
const query = ref('');
const error = ref('');
const loading = ref(false);

const firstName = ref('');
const lastName = ref('');
const dateOfBirth = ref('');
const gender = ref('');
const phone = ref('');
const address = ref('');
const bloodGroup = ref('');
const mpiCode = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api('/patients', { token: auth.token });
    patients.value = data.patients;
  } catch (exception) {
    error.value = exception.message;
  } finally {
    loading.value = false;
  }
}

async function search() {
  error.value = '';
  try {
    if (query.value.trim() === '') {
      await load();
      return;
    }
    const data = await api(
      '/patients/search?q=' + encodeURIComponent(query.value.trim()),
      { token: auth.token }
    );
    patients.value = data.results;
  } catch (exception) {
    error.value = exception.message;
  }
}

async function createPatient() {
  error.value = '';
  try {
    await api('/patients', {
      method: 'POST',
      token: auth.token,
      body: {
        first_name: firstName.value.trim(),
        last_name: lastName.value.trim(),
        date_of_birth: dateOfBirth.value || null,
        gender: gender.value || null,
        phone: phone.value.trim() || null,
        address: address.value.trim() || null,
        blood_group: bloodGroup.value.trim() || null,
        mpi_code: mpiCode.value.trim() || null,
      },
    });
    firstName.value = '';
    lastName.value = '';
    dateOfBirth.value = '';
    gender.value = '';
    phone.value = '';
    address.value = '';
    bloodGroup.value = '';
    mpiCode.value = '';
    await load();
  } catch (exception) {
    error.value = exception.message;
  }
}

onMounted(load);
</script>

<template>
  <main class="page">
    <header>
      <strong>HOSPIFLOW</strong>
      <nav>
        <router-link to="/">Tableau de bord</router-link>
        <router-link to="/facilities">Établissements</router-link>
      </nav>
    </header>

<section class="content">
      <h1>Patients</h1>

<p v-if="error" class="error">{{ error }}</p>

<form class="search" @submit.prevent="search">
        <input
          v-model="query"
          placeholder="Nom, téléphone, code local ou code réseau HF-…"
        />
        <button type="submit">Rechercher</button>
      </form>

<table v-if="patients.length">
        <thead>
          <tr>
            <th>Code local</th>
            <th>Code réseau</th>
            <th>Nom</th>
            <th>Naissance</th>
            <th>Téléphone</th>
            <th>Groupe</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="patient in patients" :key="patient.id">
            <td>{{ patient.local_code }}</td>
            <td><code>{{ patient.hospiflow_code }}</code></td>
            <td>{{ patient.last_name }} {{ patient.first_name }}</td>
            <td>{{ patient.date_of_birth || '—' }}</td>
            <td>{{ patient.phone || '—' }}</td>
            <td>{{ patient.blood_group || '—' }}</td>
          </tr>
        </tbody>
      </table>

<p v-else-if="!loading">Aucun patient dans cet établissement pour l'instant.</p>

<form class="create" @submit.prevent="createPatient">
        <h2>Nouveau patient</h2>
        <p class="muted">
          Laissez « Code réseau » vide pour créer un nouveau patient réseau ;
          renseignez-le (HF-…) pour rattacher ce patient dans cet établissement.
        </p>
        <label>
          Prénom
          <input v-model="firstName" required />
        </label>
        <label>
          Nom
          <input v-model="lastName" required />
        </label>
        <label>
          Date de naissance
          <input v-model="dateOfBirth" type="date" />
        </label>
        <label>
          Sexe
          <select v-model="gender">
            <option value="">—</option>
            <option value="female">Féminin</option>
            <option value="male">Masculin</option>
            <option value="other">Autre</option>
          </select>
        </label>
        <label>
          Téléphone
          <input v-model="phone" />
        </label>
        <label>
          Adresse
          <input v-model="address" />
        </label>
        <label>
          Groupe sanguin
          <input v-model="bloodGroup" maxlength="10" placeholder="O+" />
        </label>
        <label>
          Code réseau (optionnel)
          <input v-model="mpiCode" placeholder="HF-XXXXXXXXXXXX" />
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
.search { display: flex; gap: .6rem; margin-bottom: 1.2rem; }
.search input { flex: 1; padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; }
.search button, .create button { padding: .5rem 1rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; }
th, td { padding: .6rem .8rem; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: .92rem; }
th { background: #f3f4f6; }
code { background: #eef2ff; color: #3730a3; padding: .1rem .4rem; border-radius: 6px; font-size: .82rem; }
.create { margin-top: 2rem; display: grid; gap: .6rem; max-width: 460px; background: #fff; padding: 1.5rem; border-radius: 8px; }
.create h2 { margin: 0 0 .3rem; font-size: 1.1rem; }
.muted { margin: 0; color: #6b7280; font-size: .85rem; }
label { display: grid; gap: .25rem; font-size: .9rem; }
input, select { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: .95rem; }
</style>
