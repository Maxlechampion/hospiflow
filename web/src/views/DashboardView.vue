<template>
  <div class="space-y-8 pb-12">
    
    <!-- En-tête -->
    <div class="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mt-2">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Bonjour, {{ userName }} 👋</h1>
        <p class="text-slate-500 mt-1 text-lg">Voici ce qui se passe dans votre établissement aujourd'hui.</p>
      </div>
      <div class="flex gap-3">
        <button class="bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2">
          <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          Agenda
        </button>
        <button class="bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-700 transition-all shadow-sm shadow-primary-600/20 flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          Nouveau patient
        </button>
      </div>
    </div>

    <!-- KPIs (Cartes modernes avec gradient subtil) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Carte 1 : Patients -->
      <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
        <div class="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
        <div class="relative">
          <div class="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4 text-primary-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
          </div>
          <p class="text-sm font-medium text-slate-500">Patients total</p>
          <h3 class="text-3xl font-bold text-slate-900 mt-1">{{ stats.patients }}</h3>
          <p class="text-xs font-medium text-primary-600 mt-2 flex items-center gap-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
            +2% cette semaine
          </p>
        </div>
      </div>

      <!-- Carte 2 : RDV -->
      <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
        <div class="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
        <div class="relative">
          <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4 text-blue-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
          </div>
          <p class="text-sm font-medium text-slate-500">Rendez-vous</p>
          <h3 class="text-3xl font-bold text-slate-900 mt-1">{{ stats.appointments }}</h3>
          <p class="text-xs font-medium text-blue-600 mt-2 flex items-center gap-1">Aujourd'hui</p>
        </div>
      </div>

      <!-- Carte 3 : Recettes -->
      <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
        <div class="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
        <div class="relative">
          <div class="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4 text-emerald-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </div>
          <p class="text-sm font-medium text-slate-500">Recettes</p>
          <h3 class="text-3xl font-bold text-slate-900 mt-1">{{ stats.revenue.toLocaleString() }} <span class="text-base font-medium text-slate-400">XOF</span></h3>
          <p class="text-xs font-medium text-emerald-600 mt-2 flex items-center gap-1">Période en cours</p>
        </div>
      </div>

      <!-- Carte 4 : Consultations -->
      <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-shadow">
        <div class="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
        <div class="relative">
          <div class="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4 text-amber-600">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </div>
          <p class="text-sm font-medium text-slate-500">Consultations</p>
          <h3 class="text-3xl font-bold text-slate-900 mt-1">{{ stats.consultations }}</h3>
          <p class="text-xs font-medium text-amber-600 mt-2 flex items-center gap-1">Actes réalisés</p>
        </div>
      </div>
    </div>

    <!-- Section basse -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <!-- Agenda du jour -->
      <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-lg font-bold text-slate-900">Prochains rendez-vous</h2>
          <RouterLink to="/app/appointments" class="text-sm font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg transition-colors">Voir l'agenda complet</RouterLink>
        </div>
        
        <div class="space-y-3">
          <div v-if="loadingAgenda" class="flex justify-center py-12">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
          
          <div v-else-if="upcomingAppointments.length === 0" class="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <svg class="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <p class="text-slate-500 text-sm">Aucun rendez-vous prévu aujourd'hui.</p>
          </div>

          <div v-else v-for="appt in upcomingAppointments" :key="appt.id" class="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer group">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold shadow-inner">
                {{ appt.patient.first_name[0] }}{{ appt.patient.last_name[0] }}
              </div>
              <div>
                <p class="text-sm font-bold text-slate-900 group-hover:text-primary-700 transition-colors">{{ appt.patient.first_name }} {{ appt.patient.last_name }}</p>
                <p class="text-xs text-slate-500 mt-0.5">{{ appt.reason || 'Consultation de routine' }}</p>
              </div>
            </div>
            <div class="text-right flex items-center gap-4">
              <div class="hidden sm:block">
                <p class="text-sm font-bold text-slate-900">{{ formatTime(appt.scheduled_at) }}</p>
                <p class="text-xs text-slate-500">Aujourd'hui</p>
              </div>
              <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                <svg class="w-4 h-4 text-slate-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions Rapides -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 class="text-lg font-bold text-slate-900 mb-6">Actions rapides</h2>
        <div class="space-y-3">
          <RouterLink to="/app/patients" class="flex items-center p-4 rounded-xl border border-slate-100 hover:border-primary-200 hover:bg-primary-50/50 transition-all group">
            <div class="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center mr-4 text-primary-600 group-hover:scale-110 transition-transform">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path></svg>
            </div>
            <div>
              <span class="block text-sm font-bold text-slate-900 group-hover:text-primary-700">Nouveau patient</span>
              <span class="block text-xs text-slate-500 mt-0.5">Enregistrer une admission</span>
            </div>
          </RouterLink>
          
          <RouterLink to="/app/appointments" class="flex items-center p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all group">
            <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mr-4 text-blue-600 group-hover:scale-110 transition-transform">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div>
              <span class="block text-sm font-bold text-slate-900 group-hover:text-blue-700">Prendre un RDV</span>
              <span class="block text-xs text-slate-500 mt-0.5">Planifier une consultation</span>
            </div>
          </RouterLink>
          
          <RouterLink to="/app/billing" class="flex items-center p-4 rounded-xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all group">
            <div class="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mr-4 text-emerald-600 group-hover:scale-110 transition-transform">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <div>
              <span class="block text-sm font-bold text-slate-900 group-hover:text-emerald-700">Créer une facture</span>
              <span class="block text-xs text-slate-500 mt-0.5">Encaisser un paiement</span>
            </div>
          </RouterLink>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import apiClient from '@/api/client'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const userName = computed(() => authStore.user?.name?.split(' ')[0] || 'Docteur')

const stats = ref({ patients: 0, appointments: 0, consultations: 0, revenue: 0 })
const upcomingAppointments = ref([])
const loadingAgenda = ref(true)

onMounted(async () => {
  try {
    const [reportRes, apptRes] = await Promise.all([
      apiClient.get('/reports/overview'),
      apiClient.get('/appointments')
    ])
    
    const r = reportRes.data.report
    stats.value = {
      patients: r.patients.total,
      appointments: r.appointments_by_status.scheduled || 0,
      consultations: r.consultations_in_period,
      revenue: r.billing.paid_in_period,
    }

    upcomingAppointments.value = apptRes.data.appointments.slice(0, 4)
  } catch (error) {
    console.error('Erreur dashboard', error)
  } finally {
    loadingAgenda.value = false
  }
})

const formatTime = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
</script>
