<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const facilities = ref([]);
const currentFacilityId = ref(null);
const error = ref('');
const loading = ref(false);

const code = ref('');
const name = ref('');
const city = ref('');

const canManage = computed(() => auth.canManageFacilities);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api('/facilities', { token: auth.token });
    facilities.value = data.facilities;
    currentFacilityId.value = data.current_facility_id;
    auth.currentFacilityId = data.current_facility_id;
  } catch (exception) {
    error.value = exception.message;
  } finally {
    loading.value = false;
  }
}

async function createFacility() {
  error.value = '';
  try {
    await api('/facilities', {
      method: 'POST',
      token: auth.token,
      body: {
        code: code.value.trim(),
        name: name.value.trim(),
        city: city.value.trim() || null,
      },
    });
    code.value = '';
    name.value = '';
    city.value = '';
    await load();
  } catch (exception) {
    error.value = exception.message;
  }
}

async function switchFacility(facilityId) {
  error.value = '';
  try {
    await auth.switchFacility(facilityId);
    currentFacilityId.value = auth.currentFacilityId;
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
      <router-link to="/">Tableau de bord</router-link>
    </header>

<section class="content">
      <h1>Établissements</h1>
      <p class="muted">
        Votre établissement actif détermine les données visibles dans les
        prochains modules.
      </p>

<p v-if="error" class="error">{{ error }}</p>

<table v-if="facilities.length">
        <thead>
          <tr>
            <th>Code</th>
            <th>Nom</th>
            <th>Ville</th>
            <th>Statut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="facility in facilities" :key="facility.id">
            <td>{{ facility.code }}</td>
            <td>{{ facility.name }}</td>
            <td>{{ facility.city }}</td>
            <td>{{ facility.is_active ? 'Actif' : 'Désactivé' }}</td>
            <td>
              <button
                v-if="facility.id !== currentFacilityId"
                :disabled="!facility.is_active"
                @click="switchFacility(facility.id)"
              >
                Définir actif
              </button>
              <span v-else class="badge">Actif</span>
            </td>
          </tr>
        </tbody>
      </table>

<p v-else-if="!loading">Aucun établissement rattaché à votre compte.</p>

<form v-if="canManage" class="create" @submit.prevent="createFacility">
        <h2>Créer un établissement</h2>
        <label>
          Code
          <input v-model="code" required maxlength="20" placeholder="CLIN01" />
        </label>
        <label>
          Nom
          <input v-model="name" required placeholder="Clinique Nouvelle Espérance" />
        </label>
        <label>
          Ville
          <input v-model="city" placeholder="Cotonou" />
        </label>
        <button type="submit">Créer</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.page { min-height: 100vh; }
header {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 1rem 2rem;
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
}
header strong { color: #0d6efd; letter-spacing: .05em; }
header a { color: #1f2937; text-decoration: none; }
header a:hover { text-decoration: underline; }
.content { padding: 2rem; max-width: 900px; }
.muted { color: #6b7280; }
.error { color: #dc2626; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; }
th, td { padding: .6rem .8rem; border-bottom: 1px solid #e5e7eb; text-align: left; }
th { background: #f3f4f6; }
button { padding: .4rem .8rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
.badge { background: #dcfce7; color: #166534; padding: .15rem .6rem; border-radius: 999px; font-size: .85rem; }
.create { margin-top: 2rem; display: grid; gap: .6rem; max-width: 420px; background: #fff; padding: 1.5rem; border-radius: 8px; }
.create h2 { margin: 0 0 .5rem; font-size: 1.1rem; }
label { display: grid; gap: .25rem; font-size: .9rem; }
input { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; }
</style>
