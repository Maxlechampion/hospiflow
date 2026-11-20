<template>
  <div class="flex h-screen bg-surface overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
      <div class="h-16 flex items-center px-6 border-b border-slate-200">
        <span class="text-xl font-bold text-primary-600">HOSPIFLOW</span>
      </div>
      <nav class="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <RouterLink
          v-for="item in visibleMenuItems"
          :key="item.name"
          :to="item.path"
          class="flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors"
          :class="[
            $route.name === item.name
              ? 'bg-primary-50 text-primary-700'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          ]"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Topbar -->
      <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div class="flex items-center md:hidden">
          <span class="text-lg font-bold text-primary-600">HOSPIFLOW</span>
        </div>

        <div class="hidden md:flex items-center space-x-3">
          <span class="text-xs font-medium text-slate-500">Établissement :</span>
          <select
            v-model="selectedFacilityId"
            @change="handleSwitchFacility"
            :disabled="switchingFacility || facilities.length === 0"
            class="text-sm border-slate-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 pl-3 pr-8 bg-white"
          >
            <option v-if="facilities.length === 0" value="">Aucun établissement</option>
            <option
              v-for="f in facilities"
              :key="f.id"
              :value="f.id"
              :disabled="!f.is_active"
            >
              {{ f.name }} ({{ f.code }}){{ !f.is_active ? ' — Inactif' : '' }}
            </option>
          </select>
        </div>

        <div class="flex items-center space-x-4">
          <div class="text-right hidden sm:block">
            <p class="text-sm font-medium text-slate-900">{{ authStore.user?.name || 'Utilisateur' }}</p>
            <p class="text-xs text-slate-500">{{ authStore.user?.roles?.[0] || 'Rôle' }}</p>
          </div>
          <button @click="handleLogout" class="text-sm text-slate-500 hover:text-red-600 transition-colors font-medium">
            Déconnexion
          </button>
        </div>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import apiClient from '@/api/client'

const authStore = useAuthStore()
const router = useRouter()

const facilities = ref([])
const selectedFacilityId = ref('')
const switchingFacility = ref(false)

const menuItems = [
  { name: 'dashboard', label: 'Tableau de bord', path: '/app/dashboard' },
  { name: 'patients', label: 'Patients', path: '/app/patients' },
  { name: 'appointments', label: 'Rendez-vous', path: '/app/appointments' },
  { name: 'consultations', label: 'Consultations', path: '/app/consultations' },
  { name: 'pharmacy', label: 'Pharmacie', path: '/app/pharmacy' },
  { name: 'admissions', label: 'Admissions & Lits', path: '/app/admissions' },
  { name: 'lab', label: 'Laboratoire', path: '/app/lab' },
  { name: 'billing', label: 'Facturation', path: '/app/billing' },
  { name: 'reports', label: 'Rapports', path: '/app/reports' },
  { name: 'facilities', label: 'Établissements', path: '/app/facilities', permission: 'facilities.manage' },
  { name: 'audit-logs', label: "Journal d'audit", path: '/app/audit-logs', permission: 'reports.view' },
]

const visibleMenuItems = computed(() =>
  menuItems.filter((item) => !item.permission || authStore.can(item.permission))
)

const loadFacilities = async () => {
  try {
    const { data } = await apiClient.get('/facilities')
    facilities.value = data.facilities || []
    selectedFacilityId.value = data.current_facility_id || (facilities.value[0]?.id ?? '')
  } catch {
    facilities.value = []
  }
}

const handleSwitchFacility = async () => {
  if (!selectedFacilityId.value || switchingFacility.value) return
  switchingFacility.value = true
  try {
    await apiClient.post(`/facilities/${selectedFacilityId.value}/switch`)
    if (authStore.user) {
      authStore.user.current_facility_id = Number(selectedFacilityId.value)
    }
    router.go(0)
  } catch (err) {
    console.error('Switch facility failed:', err)
    await loadFacilities()
  } finally {
    switchingFacility.value = false
  }
}

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}

onMounted(loadFacilities)
</script>
