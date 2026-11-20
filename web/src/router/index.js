import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    {
      path: '/app',
      component: () => import('@/layouts/DashboardLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/app/dashboard' },
        { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
        { path: 'patients', name: 'patients', component: () => import('@/views/PatientsView.vue') },
        { path: 'appointments', name: 'appointments', component: () => import('@/views/AppointmentsView.vue') },
        { path: 'consultations', name: 'consultations', component: () => import('@/views/ConsultationsView.vue') },
        { path: 'pharmacy', name: 'pharmacy', component: () => import('@/views/PharmacyView.vue') },
        { path: 'admissions', name: 'admissions', component: () => import('@/views/AdmissionsView.vue') },
        { path: 'lab', name: 'lab', component: () => import('@/views/LabView.vue') },
        { path: 'billing', name: 'billing', component: () => import('@/views/BillingView.vue') },
        { path: 'reports', name: 'reports', component: () => import('@/views/Reports.vue') },
      ]
    },
    { path: '/', redirect: '/login' }
  ]
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' }
  }
})

export default router
