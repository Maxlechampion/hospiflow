<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

const drugs = ref([]);
const lots = ref([]);
const dispensations = ref([]);
const patients = ref([]);
const error = ref('');

const showOnlyExpiring = ref(false);

const drugId = ref('');
const drugName = ref('');
const drugForm = ref('comprimé');
const drugDosage = ref('');
const drugUnit = ref('');

const lotDrugId = ref('');
const lotNumber = ref('');
const lotQuantity = ref('');
const lotExpiresAt = ref('');

const dispensePatientId = ref('');
const dispenseDrugId = ref('');
const dispenseQuantity = ref('');
const dispenseNotes = ref('');

const lotsSorted = computed(() => {
  const sorted = [...lots.value].sort((a, b) => {
    const dateA = a.expires_at || '9999-12-31';
    const dateB = b.expires_at || '9999-12-31';
    return dateA.localeCompare(dateB);
  });
  return showOnlyExpiring.value
    ? sorted.filter((lot) => lot.expiring_soon)
    : sorted;
});

async function loadAll() {
  error.value = '';
  try {
    const drugsData = await api('/pharmacy/drugs', { token: auth.token });
    drugs.value = drugsData.drugs;

const stockData = await api('/pharmacy/stock', { token: auth.token });
    lots.value = stockData.lots;

const dispensationsData = await api('/pharmacy/dispensations', {
      token: auth.token,
    });
    dispensations.value = dispensationsData.dispensations;
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

async function createDrug() {
  error.value = '';
  try {
    await api('/pharmacy/drugs', {
      method: 'POST',
      token: auth.token,
      body: {
        name: drugName.value.trim(),
        form: drugForm.value,
        dosage: drugDosage.value.trim() || null,
        unit: drugUnit.value.trim(),
      },
    });
    drugName.value = '';
    drugDosage.value = '';
    drugUnit.value = '';
    await loadAll();
  } catch (exception) {
    error.value = exception.message;
  }
}

async function addLot() {
  error.value = '';
  try {
    await api('/pharmacy/stock', {
      method: 'POST',
      token: auth.token,
      body: {
        drug_id: Number(lotDrugId.value),
        lot_number: lotNumber.value.trim() || null,
        quantity: Number(lotQuantity.value),
        expires_at: lotExpiresAt.value || null,
      },
    });
    lotDrugId.value = '';
    lotNumber.value = '';
    lotQuantity.value = '';
    lotExpiresAt.value = '';
    await loadAll();
  } catch (exception) {
    error.value = exception.message;
  }
}

async function dispense() {
  error.value = '';
  try {
    await api('/pharmacy/dispensations', {
      method: 'POST',
      token: auth.token,
      body: {
        patient_id: Number(dispensePatientId.value),
        drug_id: Number(dispenseDrugId.value),
        quantity: Number(dispenseQuantity.value),
        notes: dispenseNotes.value.trim() || null,
      },
    });
    dispensePatientId.value = '';
    dispenseDrugId.value = '';
    dispenseQuantity.value = '';
    dispenseNotes.value = '';
    await loadAll();
  } catch (exception) {
    error.value = exception.message;
  }
}

onMounted(async () => {
  await loadPatients();
  await loadAll();
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
        <router-link to="/facilities">Établissements</router-link>
      </nav>
    </header>

<section class="content">
      <h1>Pharmacie</h1>

<p v-if="error" class="error">{{ error }}</p>

<h2>Stock</h2>
      <label class="toggle">
        <input v-model="showOnlyExpiring" type="checkbox" />
        Afficher uniquement les lots proches de péremption
      </label>

<table v-if="lotsSorted.length">
        <thead>
          <tr>
            <th>Médicament</th>
            <th>Lot</th>
            <th>Quantité</th>
            <th>Péremption</th>
            <th>Alerte</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lot in lotsSorted" :key="lot.id">
            <td>
              {{ lot.drug.name }}
              <small v-if="lot.drug.dosage"> — {{ lot.drug.dosage }}</small>
            </td>
            <td>{{ lot.lot_number || '—' }}</td>
            <td>{{ lot.quantity }} {{ lot.drug.unit }}(s)</td>
            <td>{{ lot.expires_at || '—' }}</td>
            <td>
              <span v-if="lot.expired" class="badge expired">Périmé</span>
              <span v-else-if="lot.expiring_soon" class="badge expiring">Péremption proche</span>
              <span v-else-if="lot.quantity === 0" class="badge empty">Épuisé</span>
              <template v-else>—</template>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else>Aucun lot en stock pour ce filtre.</p>

<div class="grid">
        <form class="card" @submit.prevent="addLot">
          <h2>Entrée de stock (nouveau lot)</h2>

<label>
            Médicament
            <select v-model="lotDrugId" required>
              <option value="" disabled>— Choisir —</option>
              <option v-for="drug in drugs.filter((d) => d.is_active)" :key="drug.id" :value="drug.id">
                {{ drug.name }}
              </option>
            </select>
          </label>

<label>
            N° de lot
            <input v-model="lotNumber" placeholder="L-2026-04" />
          </label>

<label>
            Quantité
            <input v-model="lotQuantity" type="number" min="1" required />
          </label>

<label>
            Péremption
            <input v-model="lotExpiresAt" type="date" />
          </label>

<button type="submit">Ajouter le lot</button>
        </form>

<form class="card" @submit.prevent="dispense">
          <h2>Dispenser au patient</h2>

<label>
            Patient
            <select v-model="dispensePatientId" required>
              <option value="" disabled>— Choisir —</option>
              <option v-for="patient in patients" :key="patient.id" :value="patient.id">
                {{ patient.last_name }} {{ patient.first_name }} ({{ patient.local_code }})
              </option>
            </select>
          </label>

<label>
            Médicament
            <select v-model="dispenseDrugId" required>
              <option value="" disabled>— Choisir —</option>
              <option v-for="drug in drugs.filter((d) => d.is_active)" :key="drug.id" :value="drug.id">
                {{ drug.name }}
              </option>
            </select>
          </label>

<label>
            Quantité
            <input v-model="dispenseQuantity" type="number" min="1" required />
          </label>

<label>
            Notes
            <input v-model="dispenseNotes" placeholder="Posologie, instructions…" />
          </label>

<button type="submit">Dispenser</button>
        </form>

<form class="card" @submit.prevent="createDrug">
          <h2>Ajouter au catalogue</h2>

<label>
            Nom
            <input v-model="drugName" required placeholder="Paracétamol" />
          </label>

<label>
            Forme
            <select v-model="drugForm">
              <option value="comprimé">Comprimé</option>
              <option value="capsule">Capsule</option>
              <option value="sirop">Sirop</option>
              <option value="injection">Injection</option>
              <option value="pommade">Pommade</option>
              <option value="autre">Autre</option>
            </select>
          </label>

<label>
            Dosage
            <input v-model="drugDosage" placeholder="500 mg" />
          </label>

<label>
            Unité
            <input v-model="drugUnit" required placeholder="comprimé, ml…" />
          </label>

<button type="submit">Enregistrer</button>
        </form>
      </div>

<h2>Historique des dispensations</h2>
      <table v-if="dispensations.length">
        <thead>
          <tr>
            <th>Date</th>
            <th>Patient</th>
            <th>Médicament</th>
            <th>Quantité</th>
            <th>Par</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="dispensation in dispensations" :key="dispensation.id">
            <td>{{ dispensation.created_at }}</td>
            <td>
              {{ dispensation.patient.last_name }} {{ dispensation.patient.first_name }}
              <br />
              <small>{{ dispensation.patient.local_code }}</small>
            </td>
            <td>{{ dispensation.drug.name }}</td>
            <td>{{ dispensation.quantity }} {{ dispensation.drug.unit }}(s)</td>
            <td>{{ dispensation.dispensed_by }}</td>
          </tr>
        </tbody>
      </table>
      <p v-else>Aucune dispensation enregistrée.</p>
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
h2 { margin: 1.6rem 0 .8rem; font-size: 1.15rem; }
.toggle { display: inline-flex; gap: .5rem; align-items: center; font-size: .9rem; margin-bottom: .8rem; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; }
th, td { padding: .55rem .8rem; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: .9rem; }
th { background: #f3f4f6; }
.badge { padding: .15rem .6rem; border-radius: 999px; font-size: .8rem; background: #e5e7eb; color: #374151; }
.badge.expiring { background: #fef3c7; color: #92400e; }
.badge.expired { background: #fee2e2; color: #991b1b; }
.badge.empty { background: #f3f4f6; color: #6b7280; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.2rem; }
.card { display: grid; gap: .6rem; background: #fff; padding: 1.5rem; border-radius: 8px; align-content: start; }
.card h2 { margin: 0 0 .3rem; }
label { display: grid; gap: .25rem; font-size: .9rem; }
input, select { padding: .5rem .7rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: .95rem; }
.card button { padding: .6rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; cursor: pointer; }
</style>
