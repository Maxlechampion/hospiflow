<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Établissements & Membres</h1>
        <p class="text-sm text-slate-500 mt-1">
          Gerez les établissements multi-tenant, l'établissement actif et les accès utilisateurs.
        </p>
      </div>
    </div>

    <div v-if="feedback" :class="feedbackType === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'" class="border px-4 py-3 rounded-lg text-sm">
      {{ feedback }}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Liste des établissements & création -->
      <div class="lg:col-span-1 space-y-6">
        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h2 class="text-base font-semibold text-slate-900 mb-4">Établissements ({{ facilities.length }})</h2>
          <div v-if="loadingFacilities" class="text-sm text-slate-500">Chargement...</div>
          <div v-else-if="facilities.length === 0" class="text-sm text-slate-500">Aucun établissement disponible.</div>
          <ul v-else class="divide-y divide-slate-100">
            <li
              v-for="f in facilities"
              :key="f.id"
              @click="selectFacility(f)"
              class="py-3 px-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-2"
              :class="selectedFacility?.id === f.id ? 'bg-primary-50/70' : 'hover:bg-slate-50'"
            >
              <div>
                <p class="text-sm font-medium text-slate-900">
                  {{ f.name }}
                  <span v-if="currentFacilityId === f.id" class="ml-1.5 text-xs px-2 py-0.5 rounded-full bg-primary-100 text-primary-700">Actif</span>
                </p>
                <p class="text-xs text-slate-500">{{ f.code }}{{ f.city ? ' · ' + f.city : '' }}</p>
              </div>
              <span
                class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="f.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
              >
                {{ f.is_active ? 'Actif' : 'Inactif' }}
              </span>
            </li>
          </ul>
        </div>

        <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <h2 class="text-base font-semibold text-slate-900 mb-4">Nouvel établissement</h2>
          <form @submit.prevent="createFacility" class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Code *</label>
              <input v-model="newFacility.code" type="text" required placeholder="EX: CLI-COT-02" class="w-full text-sm border-slate-300 rounded-lg" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Nom *</label>
              <input v-model="newFacility.name" type="text" required placeholder="Clinique Saint-Michel" class="w-full text-sm border-slate-300 rounded-lg" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Ville</label>
              <input v-model="newFacility.city" type="text" placeholder="Cotonou" class="w-full text-sm border-slate-300 rounded-lg" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">Téléphone</label>
              <input v-model="newFacility.phone" type="text" placeholder="+229 01 00 00 00 00" class="w-full text-sm border-slate-300 rounded-lg" />
            </div>
            <button
              type="submit"
              :disabled="creatingFacility"
              class="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {{ creatingFacility ? 'Création...' : 'Créer l\'établissement' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Gestion des membres de l'établissement sélectionné -->
      <div class="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div v-if="!selectedFacility" class="text-sm text-slate-500 py-8 text-center">
          Sélectionnez un établissement pour gérer ses membres.
        </div>
        <div v-else class="space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">{{ selectedFacility.name }}</h2>
              <p class="text-xs text-slate-500">Code : {{ selectedFacility.code }}{{ selectedFacility.email ? ' · ' + selectedFacility.email : '' }}</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="currentFacilityId !== selectedFacility.id && selectedFacility.is_active"
                @click="switchToSelected"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100"
              >
                Définir comme actif
              </button>
              <button
                @click="toggleActiveStatus"
                class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                {{ selectedFacility.is_active ? 'Désactiver' : 'Réactiver' }}
              </button>
            </div>
          </div>

          <!-- Rattacher un utilisateur par e-mail -->
          <form @submit.prevent="attachMember" class="flex flex-col sm:flex-row gap-3">
            <input
              v-model="attachEmail"
              type="email"
              required
              placeholder="Adresse e-mail de l'utilisateur à rattacher..."
              class="flex-1 text-sm border-slate-300 rounded-lg"
            />
            <button
              type="submit"
              :disabled="attachingMember"
              class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {{ attachingMember ? 'Rattachement...' : 'Rattacher' }}
            </button>
          </form>

          <!-- Tableau des membres -->
          <div v-if="loadingMembers" class="text-sm text-slate-500">Chargement des membres...</div>
          <div v-else-if="membersError" class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            {{ membersError }}
          </div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold text-slate-500 uppercase">
                  <th class="py-2.5 pr-4">Nom</th>
                  <th class="py-2.5 pr-4">E-mail</th>
                  <th class="py-2.5 pr-4">Statut</th>
                  <th class="py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="m in members" :key="m.id">
                  <td class="py-3 pr-4 font-medium text-slate-900">{{ m.name }}</td>
                  <td class="py-3 pr-4 text-slate-600">{{ m.email }}</td>
                  <td class="py-3 pr-4">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full font-medium"
                      :class="m.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                    >
                      {{ m.is_active ? 'Actif' : 'Inactif' }}
                    </span>
                  </td>
                  <td class="py-3 text-right">
                    <button
                      @click="detachMember(m.id)"
                      class="text-xs font-medium text-red-600 hover:text-red-800"
                    >
                      Retirer l'accès
                    </button>
                  </td>
                </tr>
                <tr v-if="members.length === 0">
                  <td colspan="4" class="py-6 text-center text-slate-500">Aucun membre rattaché à cet établissement.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import apiClient from '@/api/client'

const facilities = ref([])
const currentFacilityId = ref(null)
const selectedFacility = ref(null)
const members = ref([])
const membersError = ref('')

const loadingFacilities = ref(false)
const loadingMembers = ref(false)
const creatingFacility = ref(false)
const attachingMember = ref(false)

const attachEmail = ref('')
const feedback = ref('')
const feedbackType = ref('success')

const newFacility = ref({
  code: '',
  name: '',
  city: '',
  phone: '',
})

const notify = (msg, type = 'success') => {
  feedback.value = msg
  feedbackType.value = type
}

const loadMembers = async (facilityId) => {
  loadingMembers.value = true
  membersError.value = ''
  try {
    const { data } = await apiClient.get(`/facilities/${facilityId}/users`)
    members.value = data.users || []
  } catch (err) {
    members.value = []
    membersError.value = err.response?.data?.message || 'Accès réservé aux administrateurs (permission facilities.manage).'
  } finally {
    loadingMembers.value = false
  }
}

const selectFacility = async (facility) => {
  selectedFacility.value = facility
  await loadMembers(facility.id)
}

const loadFacilities = async () => {
  loadingFacilities.value = true
  try {
    const { data } = await apiClient.get('/facilities')
    facilities.value = data.facilities || []
    currentFacilityId.value = data.current_facility_id ?? null

    const target =
      facilities.value.find((f) => f.id === selectedFacility.value?.id) ||
      facilities.value.find((f) => f.id === currentFacilityId.value) ||
      facilities.value[0] ||
      null

    if (target) {
      await selectFacility(target)
    }
  } catch (err) {
    notify(err.response?.data?.message || 'Impossible de charger les établissements.', 'error')
  } finally {
    loadingFacilities.value = false
  }
}

const createFacility = async () => {
  creatingFacility.value = true
  feedback.value = ''
  try {
    const { data } = await apiClient.post('/facilities', newFacility.value)
    newFacility.value = { code: '', name: '', city: '', phone: '' }
    notify('Établissement créé avec succès.')
    await loadFacilities()
    if (data.facility) {
      await selectFacility(data.facility)
    }
  } catch (err) {
    notify(err.response?.data?.message || 'Erreur lors de la création.', 'error')
  } finally {
    creatingFacility.value = false
  }
}

const toggleActiveStatus = async () => {
  if (!selectedFacility.value) return
  try {
    const nextState = !selectedFacility.value.is_active
    const { data } = await apiClient.patch(`/facilities/${selectedFacility.value.id}`, {
      is_active: nextState,
    })
    selectedFacility.value = data.facility
    notify(nextState ? 'Établissement réactivé.' : 'Établissement désactivé.')
    await loadFacilities()
  } catch (err) {
    notify(err.response?.data?.message || 'Action non autorisée.', 'error')
  }
}

const switchToSelected = async () => {
  if (!selectedFacility.value) return
  try {
    await apiClient.post(`/facilities/${selectedFacility.value.id}/switch`)
    currentFacilityId.value = selectedFacility.value.id
    notify('Établissement actif mis à jour.')
  } catch (err) {
    notify(err.response?.data?.message || 'Impossible de changer d\'établissement actif.', 'error')
  }
}

const attachMember = async () => {
  if (!selectedFacility.value || !attachEmail.value) return
  attachingMember.value = true
  feedback.value = ''
  try {
    await apiClient.post(`/facilities/${selectedFacility.value.id}/users`, {
      email: attachEmail.value,
    })
    attachEmail.value = ''
    notify('Utilisateur rattaché à l\'établissement.')
    await loadMembers(selectedFacility.value.id)
  } catch (err) {
    notify(err.response?.data?.message || 'Impossible de rattacher cet utilisateur.', 'error')
  } finally {
    attachingMember.value = false
  }
}

const detachMember = async (userId) => {
  if (!selectedFacility.value) return
  try {
    await apiClient.delete(`/facilities/${selectedFacility.value.id}/users/${userId}`)
    notify('Accès utilisateur retiré.')
    await loadMembers(selectedFacility.value.id)
  } catch (err) {
    notify(err.response?.data?.message || 'Impossible de retirer cet accès.', 'error')
  }
}

onMounted(loadFacilities)
</script>
