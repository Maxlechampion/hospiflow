import { defineStore } from 'pinia'
import apiClient from '@/api/client'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
    can: (state) => (permission) => {
      const perms = state.user?.permissions
      return Array.isArray(perms) && perms.includes(permission)
    },
  },
  actions: {
    async login(email, password) {
      const { data } = await apiClient.post('/auth/login', { email, password })
      this.token = data.token
      this.user = data.user
      localStorage.setItem('token', data.token)
    },
    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
    },
    async fetchUser() {
      if (!this.token) return
      const { data } = await apiClient.get('/auth/me')
      this.user = data.user
    },
  },
})
