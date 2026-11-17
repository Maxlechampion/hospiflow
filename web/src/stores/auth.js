import { defineStore } from 'pinia';
import { api } from '../api/client';

const TOKEN_KEY = 'hospiflow_token';
const USER_KEY = 'hospiflow_user';
const FACILITY_KEY = 'hospiflow_facility';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY),
    user: JSON.parse(localStorage.getItem(USER_KEY) || 'null'),
    currentFacilityId: localStorage.getItem(FACILITY_KEY),
  }),

getters: {
    isAuthenticated: (state) => Boolean(state.token),
    roles: (state) => state.user?.roles || [],
    canManageFacilities: (state) =>
      (state.user?.permissions || []).includes('facilities.manage'),
  },

actions: {
    async login(email, password) {
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

this.token = data.token;
      this.user = data.user;

localStorage.setItem(TOKEN_KEY, this.token);
      localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    },

async loadFacilities() {
      const data = await api('/facilities', { token: this.token });
      this.currentFacilityId = data.current_facility_id;
      localStorage.setItem(FACILITY_KEY, this.currentFacilityId || '');
      return data.facilities;
    },

async switchFacility(facilityId) {
      const data = await api('/facilities/' + facilityId + '/switch', {
        method: 'POST',
        token: this.token,
      });
      this.currentFacilityId = data.current_facility_id;
      localStorage.setItem(FACILITY_KEY, this.currentFacilityId || '');
    },

async logout() {
      try {
        await api('/auth/logout', { method: 'POST', token: this.token });
      } catch {
        // Token peut être déjà révoqué ou expiré.
      }

this.token = null;
      this.user = null;
      this.currentFacilityId = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(FACILITY_KEY);
    },
  },
});
