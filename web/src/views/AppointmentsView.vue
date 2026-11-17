<template>
  <div class="space-y-6">
    <div class="flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Rendez-vous</h1>
        <p class="text-slate-500 text-sm mt-1">Gérez l'agenda de vos praticiens.</p>
      </div>
      <button class="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm">
        + Nouveau RDV
      </button>
    </div>

    <!-- Filtre date -->
    <div class="flex flex-col sm:flex-row gap-4 mb-6">
      <div class="relative flex-1 max-w-md">
        <input 
          v-model="searchQuery"
          @input="debouncedSearch"
          type="text" 
          placeholder="Rechercher un patient..." 
          class="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm"
        >
        <svg class="w-5 h-5 text-slate-400 absolute left-3 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>
      <input type="date" v-model="selectedDate" @change="fetchAppointments" class="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500">
    </div>

    <!-- Liste -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-left text-sm">
        <thead class="bg-slate-50 text-slate-500 border-b border-slate-200">
          <tr>
            <th class="px-6 py-4 font-medium">Heure</th>
            <th class="px-6 py-4 font-medium">Patient</th>
            <th class="px-6 py-4 font-medium">Praticien</th>
            <th class="px-6 py-4 font-medium">Motif</th>
            <th class="px-6 py-4 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="loading" class="text-center">
            <td colspan="5" class="px-6 py-8 text-slate-500">Chargement...</td>
          </tr>
          <tr v-else-if="appointments.length === 0" class="text-center">
            <td colspan="5" class="px-6 py-8 text-slate-500">Aucun rendez-vous pour cette date.</td>
          </tr>
          <tr v-for="appt in appointments" :key="appt.id" class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4 font-medium text-slate-900">{{ formatTime(appt.scheduled_at) }}</td>
            <td class="px-6 py-4">
              <div class="font-medium text-slate-900">{{ appt.patient.first_name }} {{ appt.patient.last_name }}</div>
              <div class="text-xs text-slate-500">{{ appt.patient.local_code }}</div>
            </td>
            <td class="px-6 py-4 text-slate-600">Dr. {{ appt.practitioner.name }}</td>
            <td class="px-6 py-4 text-slate-600">{{ appt.reason || '-' }}</td>
            <td class="px-6 py-4">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {{ appt.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import apiClient from '@/api/client'

const appointments = ref([])
const searchQuery = ref('')
const loading = ref(true)
const selectedDate = ref(new Date().toISOString().split('T')[0])

let searchTimeout = null
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => fetchAppointments(), 300)
}

const fetchAppointments = async () => {
  loading.value = true
  try {
    const { data } = await apiClient.get(`/appointments?date=${selectedDate.value}`)
    let list = data.appointments;
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter(a => 
        a.patient.first_name.toLowerCase().includes(q) || 
        a.patient.last_name.toLowerCase().includes(q)
      );
    }
    appointments.value = list;
  } catch (error) {
    console.error('Erreur chargement RDV', error)
  } finally {
    loading.value = false
  }
}

const formatTime = (dateString) => {
  return new Date(dateString).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  fetchAppointments()
})
</script>
