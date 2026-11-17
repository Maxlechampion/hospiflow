<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Pharmacie</h1>
        <p class="text-slate-500 text-sm mt-1">Gérez les stocks et les dispensations.</p>
      </div>
      <div class="flex gap-3">
        <button class="bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm">
          + Ajouter un lot
        </button>
        <button @click="openDispenseModal" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm">
          Nouvelle dispensation
        </button>
      </div>
    </div>

    <!-- Onglets -->
    <div class="relative max-w-md">
      <input 
        v-model="searchQuery"
        @input="debouncedSearch"
        type="text" 
        placeholder="Rechercher un médicament ou un lot..." 
        class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm"
      >
      <svg class="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
    </div>

    <div class="border-b border-slate-200 mt-6">
      <nav class="-mb-px flex space-x-8">
        <button @click="activeTab = 'stock'" :class="[activeTab === 'stock' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300', 'whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors']">
          Stock (Lots)
        </button>
        <button @click="activeTab = 'catalogue'" :class="[activeTab === 'catalogue' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300', 'whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors']">
          Catalogue
        </button>
        <button @click="activeTab = 'dispensations'" :class="[activeTab === 'dispensations' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300', 'whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors']">
          Historique des dispensations
        </button>
      </nav>
    </div>

    <!-- Contenu : Stock -->
    <div v-if="activeTab === 'stock'" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm whitespace-nowrap">
        <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 font-medium">Médicament</th>
            <th class="px-6 py-4 font-medium">N° Lot</th>
            <th class="px-6 py-4 font-medium">Quantité</th>
            <th class="px-6 py-4 font-medium">Péremption</th>
            <th class="px-6 py-4 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loadingStock" class="text-center">
            <td colspan="5" class="px-6 py-8 text-slate-500">Chargement...</td>
          </tr>
          <tr v-else-if="stockLots.length === 0" class="text-center">
            <td colspan="5" class="px-6 py-8 text-slate-500">Aucun lot en stock.</td>
          </tr>
          <tr v-for="lot in stockLots" :key="lot.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4">
              <div class="font-medium text-slate-900">{{ lot.drug.name }}</div>
              <div class="text-xs text-slate-500">{{ lot.drug.form }} {{ lot.drug.dosage }}</div>
            </td>
            <td class="px-6 py-4 text-slate-600">{{ lot.lot_number || '-' }}</td>
            <td class="px-6 py-4 font-bold" :class="lot.quantity <= 10 ? 'text-red-600' : 'text-slate-900'">{{ lot.quantity }} {{ lot.drug.unit }}</td>
            <td class="px-6 py-4 text-slate-600">{{ formatDate(lot.expires_at) }}</td>
            <td class="px-6 py-4">
              <span v-if="lot.expired" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">Périmé</span>
              <span v-else-if="lot.expiring_soon" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">Périme bientôt</span>
              <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">Valide</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Contenu : Catalogue -->
    <div v-if="activeTab === 'catalogue'" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm whitespace-nowrap">
        <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 font-medium">Nom</th>
            <th class="px-6 py-4 font-medium">Forme</th>
            <th class="px-6 py-4 font-medium">Dosage</th>
            <th class="px-6 py-4 font-medium">Unité</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="drug in drugs" :key="drug.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 font-medium text-slate-900">{{ drug.name }}</td>
            <td class="px-6 py-4 text-slate-600">{{ drug.form }}</td>
            <td class="px-6 py-4 text-slate-600">{{ drug.dosage }}</td>
            <td class="px-6 py-4 text-slate-600">{{ drug.unit }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Contenu : Dispensations -->
    <div v-if="activeTab === 'dispensations'" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm whitespace-nowrap">
        <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 font-medium">Date</th>
            <th class="px-6 py-4 font-medium">Patient</th>
            <th class="px-6 py-4 font-medium">Médicament</th>
            <th class="px-6 py-4 font-medium">Quantité</th>
            <th class="px-6 py-4 font-medium">Dispensé par</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="disp in dispensations" :key="disp.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 text-slate-600">{{ formatDate(disp.created_at) }}</td>
            <td class="px-6 py-4 font-medium text-slate-900">{{ disp.patient.first_name }} {{ disp.patient.last_name }}</td>
            <td class="px-6 py-4 text-slate-600">{{ disp.drug.name }} ({{ disp.drug.unit }})</td>
            <td class="px-6 py-4 font-bold text-slate-900">{{ disp.quantity }}</td>
            <td class="px-6 py-4 text-slate-600">{{ disp.dispensed_by }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL : Dispensation -->
    <div v-if="showDispenseModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 class="text-lg font-semibold text-slate-900">Nouvelle dispensation</h3>
          <button @click="closeDispenseModal" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
            <select v-model="dispensation.patient_id" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
              <option value="" disabled>Sélectionnez un patient</option>
              <option v-for="p in patientList" :key="p.id" :value="p.id">{{ p.first_name }} {{ p.last_name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Médicament *</label>
            <select v-model="dispensation.drug_id" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
              <option value="" disabled>Sélectionnez un médicament</option>
              <option v-for="d in drugs" :key="d.id" :value="d.id">{{ d.name }} ({{ d.unit }})</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Quantité *</label>
            <input v-model.number="dispensation.quantity" type="number" min="1" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Notes (optionnel)</label>
            <textarea v-model="dispensation.notes" rows="2" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"></textarea>
          </div>
        </div>
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button @click="closeDispenseModal" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Annuler</button>
          <button @click="processDispense" :disabled="savingDispense" class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {{ savingDispense ? 'Enregistrement...' : 'Dispenser' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import apiClient from '@/api/client'

const activeTab = ref('stock')
const searchQuery = ref('')
const loadingStock = ref(true)
const savingDispense = ref(false)

const stockLots = ref([])
const drugs = ref([])
const dispensations = ref([])
const patientList = ref([])

const showDispenseModal = ref(false)
const dispensation = ref({ patient_id: '', drug_id: '', quantity: 1, notes: '' })

const fetchStock = async () => {
  loadingStock.value = true
  try {
    const { data } = await apiClient.get('/pharmacy/stock')
    let list = data.lots;
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter(l => 
        l.drug.name.toLowerCase().includes(q) || 
        (l.lot_number && l.lot_number.toLowerCase().includes(q))
      );
    }
    stockLots.value = list
  } catch (error) {
    console.error(error)
  } finally {
    loadingStock.value = false
  }
}

const fetchDrugs = async () => {
  try {
    const { data } = await apiClient.get('/pharmacy/drugs')
    let list = data.drugs;
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter(d => 
        d.name.toLowerCase().includes(q) || 
        d.form.toLowerCase().includes(q)
      );
    }
    drugs.value = list
  } catch (error) {
    console.error(error)
  }
}

const fetchDispensations = async () => {
  try {
    const { data } = await apiClient.get('/pharmacy/dispensations')
    dispensations.value = data.dispensations
  } catch (error) {
    console.error(error)
  }
}

const fetchPatients = async () => {
  try {
    const { data } = await apiClient.get('/patients')
    patientList.value = data.patients
  } catch (error) {
    console.error(error)
  }
}

const openDispenseModal = () => {
  dispensation.value = { patient_id: '', drug_id: '', quantity: 1, notes: '' }
  showDispenseModal.value = true
}

const closeDispenseModal = () => {
  showDispenseModal.value = false
}

const processDispense = async () => {
  savingDispense.value = true
  try {
    await apiClient.post('/pharmacy/dispensations', dispensation.value)
    closeDispenseModal()
    fetchStock()
    fetchDispensations()
    activeTab.value = 'dispensations'
  } catch (error) {
    alert("Erreur : " + (error.response?.data?.error?.message || error.message))
  } finally {
    savingDispense.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('fr-FR')
}

onMounted(() => {
  fetchStock()
  fetchDrugs()
  fetchDispensations()
  fetchPatients()
})
</script>
