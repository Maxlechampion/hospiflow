<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Consultations</h1>
        <p class="text-slate-500 text-sm mt-1">Consultez l'historique et créez de nouveaux actes médicaux.</p>
      </div>
      <button @click="openCreateModal" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        Nouvelle consultation
      </button>
    </div>

    <!-- Liste des consultations -->
    <div class="relative max-w-md mb-6">
      <input 
        v-model="searchQuery"
        @input="debouncedSearch"
        type="text" 
        placeholder="Rechercher par patient ou motif..." 
        class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm"
      >
      <svg class="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
    </div>
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm whitespace-nowrap">
        <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 font-medium">Date</th>
            <th class="px-6 py-4 font-medium">Patient</th>
            <th class="px-6 py-4 font-medium">Motif</th>
            <th class="px-6 py-4 font-medium">Diagnostic</th>
            <th class="px-6 py-4 font-medium">Praticien</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading" class="text-center">
            <td colspan="6" class="px-6 py-8 text-slate-500">Chargement des consultations...</td>
          </tr>
          <tr v-else-if="consultations.length === 0" class="text-center">
            <td colspan="6" class="px-6 py-8 text-slate-500">Aucune consultation enregistrée.</td>
          </tr>
          <tr v-for="consult in consultations" :key="consult.id" class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4 text-slate-600">{{ formatDate(consult.created_at) }}</td>
            <td class="px-6 py-4">
              <div class="font-medium text-slate-900">{{ consult.patient.first_name }} {{ consult.patient.last_name }}</div>
              <div class="text-xs text-slate-500">{{ consult.patient.local_code }}</div>
            </td>
            <td class="px-6 py-4 text-slate-700">{{ consult.chief_complaint }}</td>
            <td class="px-6 py-4 text-slate-700">{{ consult.diagnosis || '-' }}</td>
            <td class="px-6 py-4 text-slate-600">Dr. {{ consult.practitioner.name }}</td>
            <td class="px-6 py-4 text-right">
              <button @click="openViewModal(consult)" class="text-sm font-medium text-primary-600 hover:text-primary-800 opacity-0 group-hover:opacity-100 transition-opacity">
                Voir détail
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL : Création de consultation -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-xl">
          <h3 class="text-lg font-semibold text-slate-900">Nouvelle consultation</h3>
          <button @click="showCreateModal = false" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <div class="p-6 space-y-5">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
              <select v-model="newConsultation.patient_id" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
                <option value="" disabled>Sélectionnez un patient</option>
                <option v-for="p in patientList" :key="p.id" :value="p.id">{{ p.first_name }} {{ p.last_name }}</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Date de suivi</label>
              <input v-model="newConsultation.follow_up_date" type="date" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Motif de consultation *</label>
            <input v-model="newConsultation.chief_complaint" type="text" placeholder="Ex: Fièvre persistante, douleurs abdominales..." class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Examen clinique</label>
            <textarea v-model="newConsultation.examination" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"></textarea>
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Diagnostic</label>
            <input v-model="newConsultation.diagnosis" type="text" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
          </div>
          
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Traitement / Prescription</label>
            <textarea v-model="newConsultation.treatment" rows="3" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"></textarea>
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
          <button @click="showCreateModal = false" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Annuler</button>
          <button @click="createConsultation" :disabled="saving" class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {{ saving ? 'Enregistrement...' : 'Enregistrer la consultation' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL : Détail consultation -->
    <div v-if="showViewModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-primary-50">
          <div>
            <h3 class="text-lg font-semibold text-primary-900">Consultation du {{ formatDate(selectedConsultation?.created_at) }}</h3>
            <p class="text-sm text-primary-700">{{ selectedConsultation?.patient.first_name }} {{ selectedConsultation?.patient.last_name }}</p>
          </div>
          <button @click="showViewModal = false" class="text-primary-600 hover:text-primary-800">✕</button>
        </div>
        
        <div class="p-6 space-y-6">
          <div>
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Motif</h4>
            <p class="text-slate-900 text-sm">{{ selectedConsultation?.chief_complaint }}</p>
          </div>
          <div>
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Examen clinique</h4>
            <p class="text-slate-900 text-sm whitespace-pre-wrap">{{ selectedConsultation?.examination || 'Non renseigné' }}</p>
          </div>
          <div>
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Diagnostic</h4>
            <p class="text-slate-900 text-sm font-medium">{{ selectedConsultation?.diagnosis || 'Non renseigné' }}</p>
          </div>
          <div>
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Traitement</h4>
            <div class="bg-slate-50 p-4 rounded-lg text-sm text-slate-900 whitespace-pre-wrap">{{ selectedConsultation?.treatment || 'Aucun traitement prescrit' }}</div>
          </div>
          <div class="text-xs text-slate-400 border-t border-slate-100 pt-4 mt-4">
            Praticien : Dr. {{ selectedConsultation?.practitioner.name }} | Suivi prévu : {{ selectedConsultation?.follow_up_date ? formatDate(selectedConsultation.follow_up_date) : 'Non planifié' }}
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button @click="showViewModal = false" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Fermer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import apiClient from '@/api/client'

const consultations = ref([])
const searchQuery = ref('')
const loading = ref(true)
const patientList = ref([])

const showCreateModal = ref(false)
const saving = ref(false)
const newConsultation = ref({
  patient_id: '',
  chief_complaint: '',
  examination: '',
  diagnosis: '',
  treatment: '',
  follow_up_date: '',
})

const showViewModal = ref(false)
const selectedConsultation = ref(null)

let searchTimeout = null
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => fetchConsultations(), 300)
}

const fetchConsultations = async () => {
  loading.value = true
  try {
    const { data } = await apiClient.get('/consultations')
    let list = data.consultations;
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter(c => 
        c.patient.first_name.toLowerCase().includes(q) || 
        c.patient.last_name.toLowerCase().includes(q) ||
        c.chief_complaint.toLowerCase().includes(q)
      );
    }
    consultations.value = list;
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
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

const openCreateModal = () => {
  newConsultation.value = {
    patient_id: '',
    chief_complaint: '',
    examination: '',
    diagnosis: '',
    treatment: '',
    follow_up_date: '',
  }
  showCreateModal.value = true
}

const createConsultation = async () => {
  saving.value = true
  try {
    await apiClient.post('/consultations', newConsultation.value)
    showCreateModal.value = false
    fetchConsultations()
  } catch (error) {
    alert("Erreur : " + (error.response?.data?.error?.message || error.message))
  } finally {
    saving.value = false
  }
}

const openViewModal = (consult) => {
  selectedConsultation.value = consult
  showViewModal.value = true
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  fetchConsultations()
  fetchPatients()
})
</script>
