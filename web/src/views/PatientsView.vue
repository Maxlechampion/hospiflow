<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Patients</h1>
        <p class="text-slate-500 text-sm mt-1">Gérez les dossiers de vos patients.</p>
      </div>
      <button 
        @click="openCreateModal"
        class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        Nouveau Patient
      </button>
    </div>

    <!-- Recherche -->
    <div class="relative max-w-md">
      <input 
        v-model="searchQuery"
        @input="debouncedSearch"
        type="text" 
        placeholder="Rechercher par nom ou code..." 
        class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm"
      >
      <svg class="w-5 h-5 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
    </div>

    <!-- Tableau -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm whitespace-nowrap">
        <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 font-medium">Code Local</th>
            <th class="px-6 py-4 font-medium">Nom complet</th>
            <th class="px-6 py-4 font-medium">Date de naissance</th>
            <th class="px-6 py-4 font-medium">Téléphone</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading" class="text-center">
            <td colspan="5" class="px-6 py-8 text-slate-500">Chargement des patients...</td>
          </tr>
          <tr v-else-if="patients.length === 0" class="text-center">
            <td colspan="5" class="px-6 py-8 text-slate-500">Aucun patient trouvé.</td>
          </tr>
          <tr v-for="patient in patients" :key="patient.id" class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4 font-medium text-primary-600">{{ patient.local_code }}</td>
            <td class="px-6 py-4">
              <div class="font-medium text-slate-900">{{ patient.first_name }} {{ patient.last_name }}</div>
              <div class="text-xs text-slate-500">{{ patient.hospiflow_code || 'Non assigné' }}</div>
            </td>
            <td class="px-6 py-4 text-slate-600">{{ formatDate(patient.date_of_birth) }}</td>
            <td class="px-6 py-4 text-slate-600">{{ patient.phone || '-' }}</td>
            <td class="px-6 py-4 text-right">
              <button class="text-sm font-medium text-primary-600 hover:text-primary-800 opacity-0 group-hover:opacity-100 transition-opacity">
                Voir dossier
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal d'ajout avec étape de confirmation -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        
        <!-- En-tête Modal -->
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 class="text-lg font-semibold text-slate-900">
            {{ isConfirming ? 'Confirmer la création' : 'Nouveau Patient' }}
          </h3>
          <button @click="closeModal" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <!-- ÉTAPE 1 : Formulaire -->
        <div v-if="!isConfirming" class="p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Prénom *</label>
              <input v-model="newPatient.first_name" type="text" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Nom *</label>
              <input v-model="newPatient.last_name" type="text" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Téléphone</label>
            <input v-model="newPatient.phone" type="text" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-700 mb-1">Date de naissance</label>
            <input v-model="newPatient.date_of_birth" type="date" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
          </div>
        </div>

        <!-- ÉTAPE 2 : Récapitulatif de confirmation -->
        <div v-if="isConfirming" class="p-6 space-y-4">
          <div class="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
            <p class="text-sm text-blue-800">
              Veuillez vérifier que ces informations sont correctes avant d'enregistrer le patient dans le système.
            </p>
          </div>
          
          <dl class="space-y-3 text-sm">
            <div class="flex justify-between border-b border-slate-100 pb-2">
              <dt class="text-slate-500">Prénom</dt>
              <dd class="font-medium text-slate-900">{{ newPatient.first_name }}</dd>
            </div>
            <div class="flex justify-between border-b border-slate-100 pb-2">
              <dt class="text-slate-500">Nom</dt>
              <dd class="font-medium text-slate-900">{{ newPatient.last_name }}</dd>
            </div>
            <div class="flex justify-between border-b border-slate-100 pb-2">
              <dt class="text-slate-500">Téléphone</dt>
              <dd class="font-medium text-slate-900">{{ newPatient.phone || 'Non renseigné' }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-slate-500">Date de naissance</dt>
              <dd class="font-medium text-slate-900">{{ newPatient.date_of_birth ? formatDate(newPatient.date_of_birth) : 'Non renseignée' }}</dd>
            </div>
          </dl>
        </div>

        <!-- Pied du modal -->
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button 
            v-if="!isConfirming"
            @click="closeModal" 
            class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Annuler
          </button>
          
          <button 
            v-if="!isConfirming"
            @click="goToConfirmation" 
            :disabled="!isValidForm"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continuer
          </button>

          <template v-if="isConfirming">
            <button 
              @click="isConfirming = false" 
              class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
            >
              Modifier
            </button>
            <button 
              @click="createPatient" 
              :disabled="saving" 
              class="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              <svg v-if="saving" class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {{ saving ? 'Enregistrement...' : 'Confirmer et Enregistrer' }}
            </button>
          </template>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import apiClient from '@/api/client'

const patients = ref([])
const loading = ref(true)
const searchQuery = ref('')
const showModal = ref(false)
const isConfirming = ref(false)
const saving = ref(false)

const newPatient = ref({
  first_name: '',
  last_name: '',
  phone: '',
  date_of_birth: '',
})

// Validation simple pour activer le bouton "Continuer"
const isValidForm = computed(() => {
  return newPatient.value.first_name.trim() !== '' && newPatient.value.last_name.trim() !== ''
})

let searchTimeout = null

const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchPatients()
  }, 300)
}

const fetchPatients = async () => {
  loading.value = true
  try {
    let response
    if (searchQuery.value.trim().length > 0) {
      response = await apiClient.get(`/patients/search?q=${searchQuery.value}`)
      patients.value = response.data.results
    } else {
      response = await apiClient.get('/patients')
      patients.value = response.data.patients
    }
  } catch (error) {
    console.error('Erreur chargement patients', error)
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  newPatient.value = { first_name: '', last_name: '', phone: '', date_of_birth: '' }
  isConfirming.value = false
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  isConfirming.value = false
}

const goToConfirmation = () => {
  isConfirming.value = true
}

const createPatient = async () => {
  saving.value = true
  try {
    await apiClient.post('/patients', newPatient.value)
    closeModal()
    fetchPatients()
    // Optionnel : Notification de succès ici
  } catch (error) {
    alert("Erreur lors de la création : " + (error.response?.data?.error?.message || error.message))
  } finally {
    saving.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('fr-FR')
}

onMounted(() => {
  fetchPatients()
})
</script>
