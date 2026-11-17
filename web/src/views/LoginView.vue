<template>
  <div class="min-h-screen flex">
    <!-- Colonne gauche : Branding -->
    <div class="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-900 p-12 flex-col justify-between relative overflow-hidden">
      <div class="absolute inset-0 opacity-10">
        <svg class="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0 100 L100 0 L100 100 Z" fill="white" />
        </svg>
      </div>

      <div class="relative z-10">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span class="text-primary-600 font-bold text-xl">H</span>
          </div>
          <span class="text-white text-2xl font-bold tracking-tight">HOSPIFLOW</span>
        </div>
      </div>

      <div class="relative z-10">
        <h1 class="text-4xl font-bold text-white leading-tight mb-4">
          La gestion hospitalière,<br>simplifiée et sécurisée.
        </h1>
        <p class="text-primary-100 text-lg">
          Connectez-vous pour accéder à votre espace de travail et gérer vos patients en toute sérénité.
        </p>
      </div>

      <div class="relative z-10 text-primary-200 text-sm">
        © 2026 HOSPIFLOW. Tous droits réservés.
      </div>
    </div>

    <!-- Colonne droite : Formulaire -->
    <div class="flex-1 flex items-center justify-center p-8 bg-surface">
      <div class="w-full max-w-md">
        <div class="text-center mb-10 lg:hidden">
          <span class="text-3xl font-bold text-primary-600">HOSPIFLOW</span>
        </div>

        <div class="mb-8">
          <h2 class="text-3xl font-bold text-slate-900 mb-2">Bienvenue</h2>
          <p class="text-slate-500">Veuillez vous connecter à votre compte.</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Adresse e-mail</label>
            <input
              v-model="email"
              type="email"
              required
              class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              placeholder="medecin@clinique.com"
            >
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Mot de passe</label>
            <input
              v-model="password"
              type="password"
              required
              class="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
              placeholder="••••••••"
            >
          </div>

          <div class="flex items-center justify-between">
            <label class="flex items-center">
              <input type="checkbox" class="rounded border-slate-300 text-primary-600 focus:ring-primary-500">
              <span class="ml-2 text-sm text-slate-600">Se souvenir de moi</span>
            </label>
            <a href="#" class="text-sm font-medium text-primary-600 hover:text-primary-700">Mot de passe oublié ?</a>
          </div>

          <div v-if="error" class="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
          >
            <span v-if="loading" class="animate-spin mr-2">⟳</span>
            {{ loading ? 'Connexion...' : 'Se connecter' }}
          </button>
        </form>

        <p class="mt-8 text-center text-sm text-slate-500">
          Pas encore de compte ?
          <a href="#" class="font-medium text-primary-600 hover:text-primary-700">Contacter le support</a>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const router = useRouter()
const authStore = useAuthStore()

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    await authStore.login(email.value, password.value)
    router.push('/app/dashboard')
  } catch (err) {
    error.value = err.response?.data?.error?.message || 'Identifiants incorrects.'
  } finally {
    loading.value = false
  }
}
</script>
