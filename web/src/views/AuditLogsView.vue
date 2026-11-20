<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Journal d'audit</h1>
        <p class="text-sm text-slate-500 mt-1">
          Traçabilité des actions et modifications effectuées dans l'établissement actif.
        </p>
      </div>
      <div class="text-xs text-slate-500" v-if="pagination.total !== undefined">
        {{ pagination.total }} entrée(s)
      </div>
    </div>

    <!-- Filtres -->
    <form @submit.prevent="fetchLogs(1)" class="bg-white rounded-xl border border-slate-200 p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      <div>
        <label class="block text-xs font-medium text-slate-700 mb-1">Type d'entité</label>
        <select v-model="filters.subject_type" class="w-full text-sm border-slate-300 rounded-lg">
          <option value="">Tous</option>
          <option value="Patient">Patient</option>
          <option value="Consultation">Consultation</option>
          <option value="Invoice">Facture (Invoice)</option>
          <option value="Prescription">Ordonnance</option>
          <option value="Appointment">Rendez-vous</option>
          <option value="DrugLot">Lot médicament</option>
        </select>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-700 mb-1">ID entité</label>
        <input v-model="filters.subject_id" type="number" min="1" placeholder="Ex: 12" class="w-full text-sm border-slate-300 rounded-lg" />
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-700 mb-1">Événement</label>
        <select v-model="filters.event" class="w-full text-sm border-slate-300 rounded-lg">
          <option value="">Tous</option>
          <option value="created">created</option>
          <option value="updated">updated</option>
          <option value="deleted">deleted</option>
        </select>
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-700 mb-1">Du</label>
        <input v-model="filters.from" type="date" class="w-full text-sm border-slate-300 rounded-lg" />
      </div>

      <div>
        <label class="block text-xs font-medium text-slate-700 mb-1">Au</label>
        <input v-model="filters.to" type="date" class="w-full text-sm border-slate-300 rounded-lg" />
      </div>

      <div class="flex items-end gap-2">
        <button
          type="submit"
          :disabled="loading"
          class="flex-1 py-2 px-3 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Filtrer
        </button>
        <button
          type="button"
          @click="resetFilters"
          class="py-2 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm rounded-lg"
        >
          Reset
        </button>
      </div>
    </form>

    <!-- Message d'erreur / accès -->
    <div v-if="errorMsg" class="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
      {{ errorMsg }}
    </div>

    <!-- Tableau des logs -->
    <div v-else class="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div v-if="loading" class="p-6 text-sm text-slate-500">Chargement des entrées d'audit...</div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr class="text-left text-xs font-semibold text-slate-500 uppercase">
              <th class="py-3 px-4">Date</th>
              <th class="py-3 px-4">Événement</th>
              <th class="py-3 px-4">Sujet</th>
              <th class="py-3 px-4">Auteur</th>
              <th class="py-3 px-4">Détails / Changements</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="log in logs" :key="log.id" class="align-top">
              <td class="py-3 px-4 whitespace-nowrap text-xs text-slate-500">{{ log.created_at }}</td>
              <td class="py-3 px-4 whitespace-nowrap">
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  :class="eventBadgeClass(log.event)"
                >
                  {{ log.event || 'action' }}
                </span>
              </td>
              <td class="py-3 px-4 text-xs text-slate-700">
                <span class="font-medium">{{ shortSubject(log.subject?.type) }}</span>
                <span v-if="log.subject?.id" class="text-slate-400"> #{{ log.subject.id }}</span>
                <p class="text-slate-500 mt-0.5">{{ log.description }}</p>
              </td>
              <td class="py-3 px-4 text-xs text-slate-700">
                <span v-if="log.causer">{{ log.causer.name }}</span>
                <span v-else class="text-slate-400">Système</span>
              </td>
              <td class="py-3 px-4 text-xs text-slate-600 max-w-md">
                <div v-if="log.changes?.new || log.changes?.old" class="space-y-1">
                  <div v-if="log.changes.new" class="bg-emerald-50/70 text-emerald-900 px-2 py-1 rounded font-mono text-[11px] break-all">
                    + {{ JSON.stringify(log.changes.new) }}
                  </div>
                  <div v-if="log.changes.old" class="bg-rose-50/70 text-rose-900 px-2 py-1 rounded font-mono text-[11px] break-all">
                    - {{ JSON.stringify(log.changes.old) }}
                  </div>
                </div>
                <span v-else class="text-slate-400">—</span>
              </td>
            </tr>
            <tr v-if="logs.length === 0">
              <td colspan="5" class="py-8 text-center text-slate-500">Aucune entrée d'audit trouvée pour ces critères.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.last_page > 1" class="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
        <span>Page {{ pagination.current_page }} / {{ pagination.last_page }}</span>
        <div class="flex gap-2">
          <button
            :disabled="pagination.current_page <= 1 || loading"
            @click="fetchLogs(pagination.current_page - 1)"
            class="px-3 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
          >
            Précédent
          </button>
          <button
            :disabled="pagination.current_page >= pagination.last_page || loading"
            @click="fetchLogs(pagination.current_page + 1)"
            class="px-3 py-1 rounded border border-slate-300 bg-white disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import apiClient from '@/api/client'

const logs = ref([])
const pagination = ref({
  current_page: 1,
  per_page: 25,
  total: 0,
  last_page: 1,
})
const loading = ref(false)
const errorMsg = ref('')

const filters = ref({
  subject_type: '',
  subject_id: '',
  event: '',
  from: '',
  to: '',
})

const shortSubject = (fullType) => {
  if (!fullType) return 'Entité'
  const parts = String(fullType).split('\\')
  return parts[parts.length - 1]
}

const eventBadgeClass = (ev) => {
  if (ev === 'created') return 'bg-emerald-100 text-emerald-700'
  if (ev === 'updated') return 'bg-sky-100 text-sky-700'
  if (ev === 'deleted') return 'bg-rose-100 text-rose-700'
  return 'bg-slate-100 text-slate-600'
}

const fetchLogs = async (page = 1) => {
  loading.value = true
  errorMsg.value = ''
  try {
    const params = { page, per_page: 25 }
    if (filters.value.subject_type) params.subject_type = filters.value.subject_type
    if (filters.value.subject_id) params.subject_id = filters.value.subject_id
    if (filters.value.event) params.event = filters.value.event
    if (filters.value.from) params.from = filters.value.from
    if (filters.value.to) params.to = filters.value.to

    const { data } = await apiClient.get('/audit-logs', { params })
    logs.value = data.activity_logs || []
    if (data.pagination) {
      pagination.value = data.pagination
    }
  } catch (err) {
    logs.value = []
    errorMsg.value = err.response?.data?.message || "Impossible de charger le journal d'audit (permission reports.view requise)."
  } finally {
    loading.value = false
  }
}

const resetFilters = async () => {
  filters.value = {
    subject_type: '',
    subject_id: '',
    event: '',
    from: '',
    to: '',
  }
  await fetchLogs(1)
}

onMounted(() => fetchLogs(1))
</script>
