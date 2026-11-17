import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import LoginView from '../views/LoginView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
    {
      path: '/',
      component: () => import('../views/DashboardView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/facilities',
      component: () => import('../views/FacilitiesView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/patients',
      component: () => import('../views/PatientsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/appointments',
      component: () => import('../views/AppointmentsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/consultations',
      component: () => import('../views/ConsultationsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/laboratoire',
      component: () => import('../views/LabView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pharmacie',
      component: () => import('../views/PharmacyView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/facturation',
      component: () => import('../views/BillingView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/rapports',
      component: () => import('../views/Reports.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/rapports',
      component: () => import('../views/Reports.vue'),
      meta: { requiresAuth: true },
    },
        {
      path: '/rapports',
      component: () => import('../views/Reports.vue'),
      meta: { requiresAuth: true },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return '/login';
  }

if (to.path === '/login' && auth.isAuthenticated) {
    return '/';
  }
});

export default router;
