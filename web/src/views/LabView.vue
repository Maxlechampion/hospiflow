<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Laboratoire</h1>
        <p class="text-slate-500 text-sm mt-1">Gérez les demandes d'analyses et les résultats.</p>
      </div>
      <button @click="openRequestModal" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
        Nouvelle demande
      </button>
    </div>

    <!-- Filtres -->
    <div class="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div class="relative flex-1 min-w-[200px]">
        <input 
          v-model="searchQuery"
          @input="debouncedSearch"
          type="text" 
          placeholder="Rechercher un patient ou une analyse..." 
          class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm"
        >
        <svg class="w-5 h-5 text-slate-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>
      <select v-model="statusFilter" @change="fetchRequests" class="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500">
        <option value="">Tous les statuts</option>
        <option value="pending">En attente</option>
        <option value="in_progress">En cours</option>
        <option value="completed">Terminé</option>
        <option value="cancelled">Annulé</option>
      </select>
    </div>

    <!-- Tableau des demandes -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm whitespace-nowrap">
        <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 font-medium">Patient</th>
            <th class="px-6 py-4 font-medium">Analyse</th>
            <th class="px-6 py-4 font-medium">Priorité</th>
            <th class="px-6 py-4 font-medium">Date</th>
            <th class="px-6 py-4 font-medium">Statut</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading" class="text-center">
            <td colspan="6" class="px-6 py-8 text-slate-500">Chargement des demandes...</td>
          </tr>
          <tr v-else-if="requests.length === 0" class="text-center">
            <td colspan="6" class="px-6 py-8 text-slate-500">Aucune demande d'analyse trouvée.</td>
          </tr>
          <tr v-for="req in requests" :key="req.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4">
              <div class="font-medium text-slate-900">{{ req.patient.first_name }} {{ req.patient.last_name }}</div>
              <div class="text-xs text-slate-500">{{ req.patient.local_code }}</div>
            </td>
            <td class="px-6 py-4">
              <div class="font-medium text-slate-900">{{ req.panel }}</div>
              <div class="text-xs text-slate-500">Demandé par {{ req.requested_by || '-' }}</div>
            </td>
            <td class="px-6 py-4">
              <span v-if="req.priority === 'urgent'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">Urgent</span>
              <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">Routine</span>
            </td>
            <td class="px-6 py-4 text-slate-600">{{ formatDate(req.created_at) }}</td>
            <td class="px-6 py-4">
              <span 
                class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                :class="{
                  'bg-amber-50 text-amber-700 border-amber-200': req.status === 'pending',
                  'bg-blue-50 text-blue-700 border-blue-200': req.status === 'in_progress',
                  'bg-emerald-50 text-emerald-700 border-emerald-200': req.status === 'completed',
                  'bg-red-50 text-red-700 border-red-200': req.status === 'cancelled'
                }"
              >
                {{ statusLabels[req.status] }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <button 
                v-if="req.status === 'pending' || req.status === 'in_progress'"
                @click="openResultModal(req)"
                class="text-sm font-medium text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-md transition-colors"
              >
                Saisir résultat
              </button>
              <button 
                v-else-if="req.result"
                @click="viewResult(req)"
                class="text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                Voir résultat
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL : Nouvelle demande -->
    <div v-if="showRequestModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h3 class="text-lg font-semibold text-slate-900">Nouvelle demande d'analyse</h3>
          <button @click="showRequestModal = false" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
            <select v-model="newRequest.patient_id" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
              <option value="" disabled>Sélectionnez un patient</option>
              <option v-for="p in patientList" :key="p.id" :value="p.id">{{ p.first_name }} {{ p.last_name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Type d'analyse *</label>
            <select v-if="labPanels.length > 0" v-model="newRequest.lab_panel_id" @change="onSelectPanel" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm mb-2">
              <option value="">Saisie libre ou sélectionnez un panel...</option>
              <option v-for="p in labPanels" :key="p.id" :value="p.id">{{ p.name }} ({{ Number(p.price || 0).toLocaleString() }} XOF)</option>
            </select>
            <input v-model="newRequest.panel" type="text" placeholder="Ex: NFS, Glycémie..." class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
            <label class="flex items-center gap-2 text-xs text-slate-600 mt-2">
              <input v-model="newRequest.create_invoice" type="checkbox" class="rounded border-slate-300">
              Générer automatiquement une facture brouillon
            </label>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Priorité</label>
            <select v-model="newRequest.priority" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea v-model="newRequest.notes" rows="2" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"></textarea>
          </div>
        </div>
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button @click="showRequestModal = false" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Annuler</button>
          <button @click="createRequest" :disabled="saving" class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {{ saving ? 'Enregistrement...' : 'Créer la demande' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL : Résultat -->
    <div v-if="showResultModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 class="text-lg font-semibold text-slate-900">Résultat - {{ selectedRequest?.panel }}</h3>
          <button @click="closeResultModal" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <div v-if="!isViewingResult" class="p-6 space-y-4">
          <div class="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm mb-4">
            Saisissez les valeurs de l'analyse. Une fois validé, le statut passera à "Terminé".
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Valeurs *</label>
            <textarea v-model="resultData.values" rows="5" placeholder="Ex: Hémoglobine: 12.5 g/dL&#10;Leucocytes: 7500 /mm3" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:ring-primary-500 focus:border-primary-500"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Conclusion</label>
            <textarea v-model="resultData.conclusion" rows="2" placeholder="Conclusion du médecin..." class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"></textarea>
          </div>
        </div>

        <div v-else class="p-6 space-y-4">
          <div>
            <h4 class="text-sm font-medium text-slate-500 mb-1">Valeurs</h4>
            <div class="bg-slate-50 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap">{{ selectedRequest?.result?.values }}</div>
          </div>
          <div v-if="selectedRequest?.result?.conclusion">
            <h4 class="text-sm font-medium text-slate-500 mb-1">Conclusion</h4>
            <p class="text-slate-900 text-sm">{{ selectedRequest.result.conclusion }}</p>
          </div>
          <div class="text-xs text-slate-400 mt-4">
            Saisi par {{ selectedRequest?.result?.resulted_by }} le {{ formatDate(selectedRequest?.result?.resulted_at) }}
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button v-if="!isViewingResult" @click="closeResultModal" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Annuler</button>
          <button v-if="!isViewingResult" @click="saveResult" :disabled="savingResult" class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {{ savingResult ? 'Enregistrement...' : 'Valider le résultat' }}
          </button>
          <button v-if="isViewingResult" @click="closeResultModal" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Fermer</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import apiClient from '@/api/client'

const requests = ref([])
const loading = ref(true)
const searchQuery = ref('')
const statusFilter = ref('')
const patientList = ref([])
const labPanels = ref([])

const statusLabels = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  cancelled: 'Annulé'
}

// Modals
const showRequestModal = ref(false)
const saving = ref(false)
const newRequest = ref({ patient_id: '', panel: '', priority: 'routine', notes: '' })

const showResultModal = ref(false)
const isViewingResult = ref(false)
const savingResult = ref(false)
const selectedRequest = ref(null)
const resultData = ref({ values: '', conclusion: '' })

let searchTimeout = null

const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(fetchRequests, 300)
}

const fetchRequests = async () => {
  loading.value = true
  try {
    let url = '/lab-requests?'
    if (statusFilter.value) url += `status=${statusFilter.value}&`
    const { data } = await apiClient.get(url)
    let list = data.lab_requests;
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter(r => 
        r.patient.first_name.toLowerCase().includes(q) || 
        r.patient.last_name.toLowerCase().includes(q) ||
        r.panel.toLowerCase().includes(q)
      );
    }
    requests.value = list;
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const fetchPanels = async () => {
  try {
    const { data } = await apiClient.get("/lab-panels")
    labPanels.value = (data.lab_panels || []).filter((p) => p.is_active !== false)
  } catch (error) {
    console.error(error)
  }
}

const onSelectPanel = () => {
  const found = labPanels.value.find((p) => String(p.id) === String(newRequest.value.lab_panel_id))
  if (found) newRequest.value.panel = found.name
}

const fetchPatients = async () => {
  try {
    const { data } = await apiClient.get('/patients')
    patientList.value = data.patients
  } catch (error) {
    console.error(error)
  }
}

const openRequestModal = () => {
  newRequest.value = { patient_id: '', lab_panel_id: '', panel: '', priority: 'routine', notes: '', create_invoice: false }
  showRequestModal.value = true
}

const createRequest = async () => {
  saving.value = true
  try {
    await apiClient.post('/lab-requests', newRequest.value)
    showRequestModal.value = false
    fetchRequests()
  } catch (error) {
    alert("Erreur : " + (error.response?.data?.error?.message || error.message))
  } finally {
    saving.value = false
  }
}

const openResultModal = (req) => {
  selectedRequest.value = req
  resultData.value = { values: '', conclusion: '' }
  isViewingResult.value = false
  showResultModal.value = true
}

const viewResult = (req) => {
  selectedRequest.value = req
  isViewingResult.value = true
  showResultModal.value = true
}

const closeResultModal = () => {
  showResultModal.value = false
}

const saveResult = async () => {
  savingResult.value = true
  try {
    await apiClient.post(`/lab-requests/${selectedRequest.value.id}/result`, resultData.value)
    closeResultModal()
    fetchRequests()
  } catch (error) {
    alert("Erreur : " + (error.response?.data?.error?.message || error.message))
  } finally {
    savingResult.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  fetchRequests()
  fetchPatients()
  fetchPanels()
})
</script>
