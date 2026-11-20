<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Admissions &amp; Lits</h1>
        <p class="text-slate-500 text-sm mt-1">Gérez les séjours hospitaliers, la disponibilité des lits et la facturation à la sortie.</p>
      </div>
      <div class="flex gap-3">
        <button @click="showBedModal = true" class="bg-white text-slate-700 border border-slate-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50">
          + Nouveau lit
        </button>
        <button @click="openAdmitModal" class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700">
          + Nouvelle admission
        </button>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div v-for="bed in beds" :key="bed.id" class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold text-slate-900">{{ bed.code }}</div>
          <div class="text-xs text-slate-500">{{ bed.ward }}{{ bed.room_number ? " · Ch. " + bed.room_number : "" }}</div>
        </div>
        <span
          class="px-2.5 py-0.5 rounded-full text-xs font-medium"
          :class="{
            'bg-emerald-50 text-emerald-700': bed.status === 'available',
            'bg-amber-50 text-amber-700': bed.status === 'occupied',
            'bg-slate-100 text-slate-600': bed.status === 'maintenance'
          }"
        >
          {{ bedStatusLabels[bed.status] || bed.status }}
        </span>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
      <select v-model="statusFilter" @change="fetchAdmissions" class="px-4 py-2 border border-slate-300 rounded-lg text-sm">
        <option value="">Tous les statuts</option>
        <option value="admitted">En cours</option>
        <option value="discharged">Sorti</option>
        <option value="cancelled">Annulé</option>
      </select>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm whitespace-nowrap">
        <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 font-medium">Patient</th>
            <th class="px-6 py-4 font-medium">Lit</th>
            <th class="px-6 py-4 font-medium">Entrée</th>
            <th class="px-6 py-4 font-medium">Statut</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading">
            <td colspan="5" class="px-6 py-8 text-center text-slate-500">Chargement des admissions...</td>
          </tr>
          <tr v-else-if="admissions.length === 0">
            <td colspan="5" class="px-6 py-8 text-center text-slate-500">Aucune admission enregistrée.</td>
          </tr>
          <tr v-for="adm in admissions" :key="adm.id" class="hover:bg-slate-50">
            <td class="px-6 py-4">
              <div class="font-medium text-slate-900">{{ adm.patient.first_name }} {{ adm.patient.last_name }}</div>
              <div class="text-xs text-slate-500">{{ adm.patient.local_code }}</div>
            </td>
            <td class="px-6 py-4 text-slate-700">{{ adm.bed ? adm.bed.code + " (" + adm.bed.ward + ")" : "Sans lit" }}</td>
            <td class="px-6 py-4 text-slate-500">{{ adm.admitted_at }}</td>
            <td class="px-6 py-4">
              <span
                class="px-2.5 py-1 rounded-full text-xs font-medium"
                :class="{
                  'bg-blue-50 text-blue-700': adm.status === 'admitted',
                  'bg-emerald-50 text-emerald-700': adm.status === 'discharged',
                  'bg-red-50 text-red-700': adm.status === 'cancelled'
                }"
              >
                {{ admissionStatusLabels[adm.status] || adm.status }}
              </span>
            </td>
            <td class="px-6 py-4 text-right space-x-2">
              <button
                v-if="adm.status === 'admitted'"
                @click="openDischargeModal(adm)"
                class="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-md"
              >
                Sortie
              </button>
              <button
                v-if="adm.status === 'admitted'"
                @click="openCancelModal(adm)"
                class="text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md"
              >
                Annuler
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showBedModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 class="text-lg font-semibold text-slate-900">Nouveau lit</h3>
        <input v-model="newBed.ward" type="text" placeholder="Service (ex: Hospitalisation)" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
        <input v-model="newBed.room_number" type="text" placeholder="Chambre (optionnel)" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
        <input v-model="newBed.code" type="text" placeholder="Code lit (ex: HOSP-02)" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showBedModal = false" class="px-4 py-2 text-sm text-slate-600">Annuler</button>
          <button @click="createBed" class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg">Enregistrer</button>
        </div>
      </div>
    </div>

    <div v-if="showAdmitModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 class="text-lg font-semibold text-slate-900">Nouvelle admission</h3>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Patient *</label>
          <select v-model="newAdmission.patient_id" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="" disabled>Sélectionnez un patient</option>
            <option v-for="p in patients" :key="p.id" :value="p.id">{{ p.first_name }} {{ p.last_name }} ({{ p.local_code }})</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Lit disponible</label>
          <select v-model="newAdmission.bed_id" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="">Aucun lit assigné</option>
            <option v-for="b in availableBeds" :key="b.id" :value="b.id">{{ b.code }} - {{ b.ward }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Motif</label>
          <input v-model="newAdmission.reason" type="text" placeholder="Motif d'hospitalisation" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showAdmitModal = false" class="px-4 py-2 text-sm text-slate-600">Annuler</button>
          <button @click="createAdmission" class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg">Admettre</button>
        </div>
      </div>
    </div>

    <div v-if="showDischargeModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 class="text-lg font-semibold text-slate-900">Sortie du patient</h3>
        <label class="flex items-center gap-2 text-sm text-slate-700">
          <input v-model="dischargeForm.create_invoice" type="checkbox" class="rounded border-slate-300">
          Générer la facture de séjour
        </label>
        <div v-if="dischargeForm.create_invoice">
          <label class="block text-sm font-medium text-slate-700 mb-1">Tarif journalier (XOF) *</label>
          <input v-model.number="dischargeForm.daily_rate" type="number" min="1" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Statut du lit après sortie</label>
          <select v-model="dischargeForm.bed_status" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
            <option value="available">Disponible</option>
            <option value="maintenance">En maintenance</option>
          </select>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showDischargeModal = false" class="px-4 py-2 text-sm text-slate-600">Annuler</button>
          <button @click="submitDischarge" class="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg">Confirmer la sortie</button>
        </div>
      </div>
    </div>

    <div v-if="showCancelModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 class="text-lg font-semibold text-slate-900">Annuler l'admission</h3>
        <input v-model="cancelForm.reason" type="text" placeholder="Motif d'annulation" class="w-full px-3 py-2 border border-slate-300 rounded-md text-sm">
        <div class="flex justify-end gap-3 pt-2">
          <button @click="showCancelModal = false" class="px-4 py-2 text-sm text-slate-600">Fermer</button>
          <button @click="submitCancel" class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg">Annuler l'admission</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import apiClient from "@/api/client"

const admissions = ref([])
const beds = ref([])
const patients = ref([])
const loading = ref(true)
const statusFilter = ref("")

const showBedModal = ref(false)
const showAdmitModal = ref(false)
const showDischargeModal = ref(false)
const showCancelModal = ref(false)
const activeAdmission = ref(null)

const newBed = ref({ ward: "", room_number: "", code: "" })
const newAdmission = ref({ patient_id: "", bed_id: "", reason: "" })
const dischargeForm = ref({ create_invoice: false, daily_rate: 10000, bed_status: "available" })
const cancelForm = ref({ reason: "", bed_status: "available" })

const bedStatusLabels = { available: "Disponible", occupied: "Occupé", maintenance: "Maintenance" }
const admissionStatusLabels = { admitted: "En cours", discharged: "Sorti", cancelled: "Annulé" }

const availableBeds = computed(() => beds.value.filter((b) => b.status === "available"))

const fetchBeds = async () => {
  const { data } = await apiClient.get("/beds")
  beds.value = data.beds || []
}

const fetchAdmissions = async () => {
  loading.value = true
  try {
    const url = statusFilter.value ? "/admissions?status=" + encodeURIComponent(statusFilter.value) : "/admissions"
    const { data } = await apiClient.get(url)
    admissions.value = data.admissions || []
  } finally {
    loading.value = false
  }
}

const fetchPatients = async () => {
  const { data } = await apiClient.get("/patients")
  patients.value = data.patients || []
}

const createBed = async () => {
  await apiClient.post("/beds", newBed.value)
  showBedModal.value = false
  newBed.value = { ward: "", room_number: "", code: "" }
  fetchBeds()
}

const openAdmitModal = () => {
  newAdmission.value = { patient_id: "", bed_id: "", reason: "" }
  showAdmitModal.value = true
}

const createAdmission = async () => {
  await apiClient.post("/admissions", {
    ...newAdmission.value,
    bed_id: newAdmission.value.bed_id || null,
  })
  showAdmitModal.value = false
  fetchAdmissions()
  fetchBeds()
}

const openDischargeModal = (adm) => {
  activeAdmission.value = adm
  dischargeForm.value = { create_invoice: false, daily_rate: 10000, bed_status: "available" }
  showDischargeModal.value = true
}

const submitDischarge = async () => {
  await apiClient.post("/admissions/" + activeAdmission.value.id + "/discharge", dischargeForm.value)
  showDischargeModal.value = false
  fetchAdmissions()
  fetchBeds()
}

const openCancelModal = (adm) => {
  activeAdmission.value = adm
  cancelForm.value = { reason: "", bed_status: "available" }
  showCancelModal.value = true
}

const submitCancel = async () => {
  await apiClient.post("/admissions/" + activeAdmission.value.id + "/cancel", cancelForm.value)
  showCancelModal.value = false
  fetchAdmissions()
  fetchBeds()
}

onMounted(async () => {
  await Promise.all([fetchBeds(), fetchAdmissions(), fetchPatients()])
})
</script>
