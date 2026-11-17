<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const router = useRouter();
const auth = useAuthStore();

async function submit() {
  loading.value = true;
  error.value = '';

try {
    await auth.login(email.value, password.value);
    await router.push('/');
  } catch (exception) {
    error.value = exception.message || 'Connexion impossible.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login">
    <form class="card" @submit.prevent="submit">
      <h1>HOSPIFLOW</h1>
      <p>Connexion à votre espace</p>

<label>
        E-mail
        <input v-model="email" type="email" required autocomplete="email" />
      </label>

<label>
        Mot de passe
        <input
          v-model="password"
          type="password"
          required
          autocomplete="current-password"
        />
      </label>

<p v-if="error" class="error">{{ error }}</p>

<button type="submit" :disabled="loading">
        {{ loading ? 'Connexion…' : 'Se connecter' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login { display: grid; place-items: center; min-height: 100vh; }
.card {
  display: grid;
  gap: .8rem;
  width: min(340px, calc(100vw - 2rem));
  padding: 2rem;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 30px rgb(0 0 0 / 8%);
}
.card h1 { margin: 0; color: #0d6efd; font-size: 1.5rem; letter-spacing: .05em; }
.card p { margin: 0 0 .5rem; color: #6b7280; }
label { display: grid; gap: .3rem; font-size: .9rem; }
input { padding: .6rem .8rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; }
button { padding: .7rem; border: 0; border-radius: 8px; background: #0d6efd; color: #fff; font-size: 1rem; cursor: pointer; }
button:disabled { opacity: .6; }
.error { color: #dc2626 !important; font-size: .85rem; }
</style>
