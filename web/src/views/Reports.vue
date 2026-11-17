<template>
  <div class="space-y-8 pb-12">
    <!-- En-tête -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Rapports & Analytics</h1>
        <p class="text-slate-500 text-sm mt-1">Vue d'ensemble des performances de l'établissement.</p>
      </div>
      <div class="flex items-center gap-3 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
        <input type="date" v-model="dateFrom" @change="fetchReport" class="px-3 py-1.5 border-none text-sm focus:ring-0 bg-transparent text-slate-700 cursor-pointer">
        <span class="text-slate-400">→</span>
        <input type="date" v-model="dateTo" @change="fetchReport" class="px-3 py-1.5 border-none text-sm focus:ring-0 bg-transparent text-slate-700 cursor-pointer">
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>

    <template v-else>
      <!-- Section Finances -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
          <div class="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4"></div>
          <p class="text-sm font-medium text-slate-500">Recettes (Période)</p>
          <h3 class="text-3xl font-bold text-slate-900 mt-2">{{ report.billing?.paid_in_period?.toLocaleString() || 0 }} <span class="text-sm font-normal text-slate-400">XOF</span></h3>
        </div>
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
          <div class="absolute right-0 top-0 w-24 h-24 bg-red-50 rounded-bl-full -mr-4 -mt-4"></div>
          <p class="text-sm font-medium text-slate-500">Créances (Impayés)</p>
          <h3 class="text-3xl font-bold text-slate-900 mt-2">{{ report.billing?.outstanding_total?.toLocaleString() || 0 }} <span class="text-sm font-normal text-slate-400">XOF</span></h3>
        </div>
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
          <div class="absolute right-0 top-0 w-24 h-24 bg-primary-50 rounded-bl-full -mr-4 -mt-4"></div>
          <p class="text-sm font-medium text-slate-500">Taux de Recouvrement</p>
          <h3 class="text-3xl font-bold text-slate-900 mt-2">{{ report.billing?.recovery_rate_percent || 0 }} <span class="text-sm font-normal text-slate-400">%</span></h3>
        </div>
      </div>

      <!-- Section Activité Médicale -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Activité médicale (Cartes) -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 class="text-lg font-bold text-slate-900 mb-6">Activité Médicale</h2>
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Patients</p>
              <div class="flex items-end gap-2">
                <span class="text-2xl font-bold text-slate-900">{{ report.patients?.total || 0 }}</span>
                <span class="text-xs text-emerald-600 font-medium mb-1">+{{ report.patients?.new_in_period || 0 }} nouveaux</span>
              </div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Consultations</p>
              <span class="text-2xl font-bold text-slate-900">{{ report.consultations_in_period || 0 }}</span>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Dispensations</p>
              <span class="text-2xl font-bold text-slate-900">{{ report.dispensations_in_period || 0 }}</span>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Demandes Labo</p>
              <span class="text-2xl font-bold text-slate-900">{{ totalLabRequests }}</span>
            </div>
          </div>
        </div>

        <!-- Rendez-vous par statut -->
        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 class="text-lg font-bold text-slate-900 mb-6">Rendez-vous par statut</h2>
          <div class="space-y-4">
            <div v-for="(count, status) in report.appointments_by_status" :key="status" class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full" :class="getStatusColor(status)"></span>
                <span class="text-sm font-medium text-slate-700 capitalize">{{ status }}</span>
              </div>
              <span class="text-sm font-bold text-slate-900">{{ count }}</span>
            </div>
            <div v-if="Object.keys(report.appointments_by_status || {}).length === 0" class="text-sm text-slate-500 text-center py-4">
              Aucun rendez-vous sur la période.
            </div>
          </div>
        </div>

      </div>

      <!-- Alertes Stock -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6" v-if="stockReport">
        <h2 class="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <svg class="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          Alertes de Stock
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Stock bas -->
          <div>
            <h3 class="text-sm font-semibold text-slate-700 mb-3">Médicaments en rupture (≤ {{ stockReport.low_stock_threshold }})</h3>
            <div class="space-y-2">
              <div v-for="item in stockReport.low_stock" :key="item.drug" class="flex justify-between items-center p-3 bg-red-50 text-red-900 rounded-lg border border-red-100 text-sm">
                <span>{{ item.drug }}</span>
                <span class="font-bold">{{ item.total_quantity }} restants</span>
              </div>
              <div v-if="stockReport.low_stock.length === 0" class="text-sm text-slate-500">Aucun stock bas.</div>
            </div>
          </div>
          <!-- Péremption -->
          <div>
            <h3 class="text-sm font-semibold text-slate-700 mb-3">Lots périmant dans {{ stockReport.expiring_window_days }} jours</h3>
            <div class="space-y-2">
              <div v-for="lot in stockReport.expiring_lots" :key="lot.drug + lot.expiry_date" class="flex justify-between items-center p-3 bg-amber-50 text-amber-900 rounded-lg border border-amber-100 text-sm">
                <span>{{ lot.drug }} (Lot: {{ lot.expiry_date }})</span>
                <span class="font-bold">{{ lot.days_left }} j restants</span>
              </div>
              <div v-if="stockReport.expiring_lots.length === 0" class="text-sm text-slate-500">Aucun lot proche de la péremption.</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import apiClient from '@/api/client'

const report = ref({})
const stockReport = ref(null)
const loading = ref(true)

// Par défaut : 30 derniers jours
const today = new Date()
const thirtyDaysAgo = new Date()
thirtyDaysAgo.setDate(today.getDate() - 30)

const dateTo = ref(today.toISOString().split('T')[0])
const dateFrom = ref(thirtyDaysAgo.toISOString().split('T')[0])

const totalLabRequests = computed(() => {
  if (!report.value.lab_requests_by_status) return 0
  return Object.values(report.value.lab_requests_by_status).reduce((a, b) => a + b, 0)
})

const fetchReport = async () => {
  loading.value = true
  try {
    const [reportRes, stockRes] = await Promise.all([
      apiClient.get(`/reports/overview?from=${dateFrom.value}&to=${dateTo.value}`),
      apiClient.get('/reports/stock')
    ])
    report.value = reportRes.data.report
    stockReport.value = stockRes.data.report
  } catch (error) {
    console.error('Erreur chargement rapports', error)
  } finally {
    loading.value = false
  }
}

const getStatusColor = (status) => {
  const colors = {
    scheduled: 'bg-blue-400',
    confirmed: 'bg-primary-500',
    done: 'bg-emerald-500',
    cancelled: 'bg-red-500',
    no_show: 'bg-slate-400'
  }
  return colors[status] || 'bg-slate-300'
}

onMounted(() => {
  fetchReport()
})
</script>
