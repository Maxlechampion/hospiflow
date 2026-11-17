<template>
  <div class="flex h-screen bg-surface overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex">
      <div class="h-16 flex items-center px-6 border-b border-slate-200">
        <span class="text-xl font-bold text-primary-600">HOSPIFLOW</span>
      </div>
      <nav class="flex-1 px-4 py-6 space-y-1">
        <RouterLink
          v-for="item in menuItems"
          :key="item.name"
          :to="item.path"
          class="flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors"
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

        <div class="hidden md:flex items-center space-x-4">
          <select class="text-sm border-slate-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 pl-3 pr-8">
            <option>Clinique Centrale</option>
            <option>Hôpital du Nord</option>
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
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()

const menuItems = [
  { name: 'dashboard', label: 'Tableau de bord', path: '/app/dashboard' },
  { name: 'patients', label: 'Patients', path: '/app/patients' },
  { name: 'appointments', label: 'Rendez-vous', path: '/app/appointments' },
  { name: 'consultations', label: 'Consultations', path: '/app/consultations' },
  { name: 'pharmacy', label: 'Pharmacie', path: '/app/pharmacy' },
  { name: 'lab', label: 'Laboratoire', path: '/app/lab' },
  { name: 'billing', label: 'Facturation', path: '/app/billing' },
  { name: 'reports', label: 'Rapports', path: '/app/reports' },
]

const handleLogout = () => {
  authStore.logout()
  router.push('/login')
}
</script>
