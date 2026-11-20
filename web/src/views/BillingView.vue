<template>
  <div class="space-y-6">
    <!-- En-tête -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Facturation</h1>
        <p class="text-slate-500 text-sm mt-1">Gérez vos factures et encaissements.</p>
      </div>
      <div class="flex gap-3">
        <button class="bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Exporter
        </button>
        <button @click="openCreateModal" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          Nouvelle facture
        </button>
      </div>
    </div>

    <!-- Filtres -->
    <div class="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <div class="relative flex-1 min-w-[200px]">
        <input 
          v-model="searchQuery"
          @input="debouncedSearch"
          type="text" 
          placeholder="Rechercher par numéro ou patient..." 
          class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm"
        >
        <svg class="w-5 h-5 text-slate-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>
      <select v-model="statusFilter" @change="fetchInvoices" class="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500">
        <option value="">Tous les statuts</option>
        <option value="draft">Brouillon</option>
        <option value="issued">Émise</option>
        <option value="paid">Payée</option>
        <option value="cancelled">Annulée</option>
      </select>
      <select v-model="sourceFilter" @change="fetchInvoices" class="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500">
        <option value="">Toutes les sources</option>
        <option value="dispensation">Pharmacie</option>
        <option value="lab_request">Laboratoire</option>
        <option value="admission">Hospitalisation</option>
      </select>
    </div>

    <!-- Tableau des factures -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm whitespace-nowrap">
        <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 font-medium">N° Facture</th>
            <th class="px-6 py-4 font-medium">Patient</th>
            <th class="px-6 py-4 font-medium">Date</th>
            <th class="px-6 py-4 font-medium">Montant</th>
            <th class="px-6 py-4 font-medium">Statut</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading" class="text-center">
            <td colspan="6" class="px-6 py-8 text-slate-500">Chargement des factures...</td>
          </tr>
          <tr v-else-if="invoices.length === 0" class="text-center">
            <td colspan="6" class="px-6 py-8 text-slate-500">Aucune facture trouvée.</td>
          </tr>
          <tr v-for="invoice in invoices" :key="invoice.id" class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4 font-medium text-slate-900">{{ invoice.number }}</td>
            <td class="px-6 py-4">
              <div class="font-medium text-slate-900">{{ invoice.patient.first_name }} {{ invoice.patient.last_name }}</div>
              <div class="text-xs text-slate-500">{{ invoice.patient.local_code }}</div>
            </td>
            <td class="px-6 py-4 text-slate-500">{{ formatDate(invoice.created_at) }}</td>
            <td class="px-6 py-4">
              <div class="font-bold text-slate-900">{{ invoice.total_amount.toLocaleString() }} XOF</div>
              <div v-if="invoice.remaining_amount > 0 && invoice.status !== 'cancelled'" class="text-xs text-red-500">Reste: {{ invoice.remaining_amount.toLocaleString() }} XOF</div>
            </td>
            <td class="px-6 py-4">
              <span 
                class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                :class="{
                  'bg-slate-100 text-slate-700 border-slate-200': invoice.status === 'draft',
                  'bg-blue-50 text-blue-700 border-blue-200': invoice.status === 'issued',
                  'bg-emerald-50 text-emerald-700 border-emerald-200': invoice.status === 'paid',
                  'bg-red-50 text-red-700 border-red-200': invoice.status === 'cancelled'
                }"
              >
                {{ statusLabels[invoice.status] }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <button 
                v-if="invoice.status === 'issued' && invoice.remaining_amount > 0"
                @click="openPaymentModal(invoice)"
                class="text-sm font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md transition-colors"
              >
                Encaisser
              </button>
              <button 
                v-else
                class="text-sm font-medium text-primary-600 hover:text-primary-800 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Voir détail
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- MODAL : Création de facture -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-xl">
          <h3 class="text-lg font-semibold text-slate-900">Nouvelle facture</h3>
          <button @click="closeCreateModal" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <div class="p-6 space-y-5">
          <!-- Patient -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
            <select v-model="newInvoice.patient_id" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500">
              <option value="" disabled>Sélectionnez un patient</option>
              <option v-for="p in patientList" :key="p.id" :value="p.id">{{ p.first_name }} {{ p.last_name }} ({{ p.local_code }})</option>
            </select>
          </div>

          <!-- Lignes de facturation -->
          <div>
            <div class="flex justify-between items-center mb-2">
              <label class="block text-sm font-medium text-slate-700">Lignes *</label>
              <button @click="addItem" class="text-xs font-medium text-primary-600 hover:text-primary-800">+ Ajouter une ligne</button>
            </div>
            
            <div class="space-y-3">
              <div v-for="(item, index) in newInvoice.items" :key="index" class="flex gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div class="flex-1">
                  <input v-model="item.label" type="text" placeholder="Désignation (ex: Consultation)" class="w-full px-3 py-1.5 border border-slate-300 rounded text-sm mb-2">
                  <div class="flex gap-2">
                    <input v-model.number="item.quantity" type="number" min="1" placeholder="Qté" class="w-20 px-3 py-1.5 border border-slate-300 rounded text-sm">
                    <input v-model.number="item.unit_price" type="number" min="0" placeholder="Prix unitaire" class="flex-1 px-3 py-1.5 border border-slate-300 rounded text-sm">
                  </div>
                </div>
                <button @click="removeItem(index)" class="text-red-400 hover:text-red-600 p-1 mt-1">✕</button>
              </div>
            </div>
          </div>

          <!-- Total -->
          <div class="flex justify-between items-center pt-4 border-t border-slate-200">
            <span class="font-medium text-slate-600">Total à facturer :</span>
            <span class="text-2xl font-bold text-primary-600">{{ computedTotal.toLocaleString() }} XOF</span>
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 rounded-b-xl">
          <button @click="closeCreateModal" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Annuler</button>
          <button @click="createInvoice" :disabled="saving" class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {{ saving ? 'Création...' : 'Créer en brouillon' }}
          </button>
        </div>
      </div>
    </div>

    <!-- MODAL : Encaissement -->
    <div v-if="showPaymentModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-emerald-50">
          <h3 class="text-lg font-semibold text-emerald-900">Encaisser la facture {{ selectedInvoice?.number }}</h3>
          <button @click="closePaymentModal" class="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
        
        <div class="p-6 space-y-4">
          <div class="bg-slate-50 p-4 rounded-lg flex justify-between items-center border border-slate-200">
            <span class="text-sm font-medium text-slate-600">Reste à payer</span>
            <span class="text-lg font-bold text-slate-900">{{ selectedInvoice?.remaining_amount.toLocaleString() }} XOF</span>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Montant reçu</label>
            <input v-model.number="payment.amount" type="number" max="selectedInvoice?.remaining_amount" class="w-full px-3 py-2 border border-slate-300 rounded-md text-lg font-bold focus:ring-emerald-500 focus:border-emerald-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Mode de paiement</label>
            <select v-model="payment.method" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-emerald-500 focus:border-emerald-500">
              <option value="cash">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="transfer">Virement</option>
            </select>
          </div>
        </div>

        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button @click="closePaymentModal" class="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">Annuler</button>
          <button @click="processPayment" :disabled="savingPayment" class="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {{ savingPayment ? 'Encaissement...' : 'Confirmer' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import apiClient from '@/api/client'

const invoices = ref([])
const loading = ref(true)
const searchQuery = ref('')
const statusFilter = ref('')
const sourceFilter = ref('')

const statusLabels = {
  draft: 'Brouillon',
  issued: 'Émise',
  paid: 'Payée',
  cancelled: 'Annulée'
}

// --- Création ---
const showCreateModal = ref(false)
const saving = ref(false)
const patientList = ref([])
const newInvoice = ref({ patient_id: '', items: [{ label: '', quantity: 1, unit_price: 0 }] })

const computedTotal = computed(() => {
  return newInvoice.value.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)
})

// --- Paiement ---
const showPaymentModal = ref(false)
const savingPayment = ref(false)
const selectedInvoice = ref(null)
const payment = ref({ amount: 0, method: 'cash' })

let searchTimeout = null

const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(fetchInvoices, 300)
}

const fetchInvoices = async () => {
  loading.value = true
  try {
    let url = '/invoices?'
    if (statusFilter.value) url += 'status=' + encodeURIComponent(statusFilter.value) + '&'
    if (sourceFilter.value) url += 'source=' + encodeURIComponent(sourceFilter.value) + '&'
    const { data } = await apiClient.get(url)
    invoices.value = data.invoices
  } catch (error) {
    console.error('Erreur chargement factures', error)
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
  newInvoice.value = { patient_id: '', items: [{ label: '', quantity: 1, unit_price: 0 }] }
  showCreateModal.value = true
}

const closeCreateModal = () => showCreateModal.value = false

const addItem = () => newInvoice.value.items.push({ label: '', quantity: 1, unit_price: 0 })
const removeItem = (index) => {
  if (newInvoice.value.items.length > 1) newInvoice.value.items.splice(index, 1)
}

const createInvoice = async () => {
  saving.value = true
  try {
    await apiClient.post('/invoices', newInvoice.value)
    closeCreateModal()
    fetchInvoices()
  } catch (error) {
    alert("Erreur lors de la création : " + (error.response?.data?.error?.message || error.message))
  } finally {
    saving.value = false
  }
}

const openPaymentModal = (invoice) => {
  selectedInvoice.value = invoice
  payment.value = { amount: invoice.remaining_amount, method: 'cash' }
  showPaymentModal.value = true
}

const closePaymentModal = () => showPaymentModal.value = false

const processPayment = async () => {
  savingPayment.value = true
  try {
    await apiClient.post(`/invoices/${selectedInvoice.value.id}/payments`, payment.value)
    closePaymentModal()
    fetchInvoices()
  } catch (error) {
    alert("Erreur d'encaissement : " + (error.response?.data?.error?.message || error.message))
  } finally {
    savingPayment.value = false
  }
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('fr-FR')
}

onMounted(() => {
  fetchInvoices()
  fetchPatients()
})
</script>
