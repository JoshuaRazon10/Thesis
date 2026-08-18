<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

import { useToastStore } from '@/stores/toast';

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const showPassword = ref(false);

const authStore = useAuthStore();
const toastStore = useToastStore();
const router = useRouter();

onMounted(() => {
  if (authStore.loading) {
    authStore.init();
  }
  if (authStore.user) {
    router.replace('/dashboard');
  }
});

const handleSubmit = async () => {
  error.value = '';
  loading.value = true;
  const result = await authStore.login(username.value, password.value);
  if (result.success) {
    toastStore.showToast('Login successful! Welcome back.', 'success');
    router.replace('/dashboard');
  } else {
    error.value = result.message ?? 'Login failed';
    toastStore.showToast(result.message ?? 'Invalid credentials.', 'error');
  }
  loading.value = false;
};
</script>

<template>
  <div class="page">
    <div class="bgGradient" />

    <div class="container">
      <div class="card">
        <div class="header">
          <img src="/images/chcc_circle.png" alt="CHCC Logo" class="logoImage" />
          <h1 class="title">Login</h1>
          <p class="subtitle">Basic Education of Concepcion Holy Cross College, Inc.</p>
        </div>

        <div class="divider" />

        <div v-if="error" class="errorAlert">⚠️ {{ error }}</div>

        <form @submit.prevent="handleSubmit" class="form">
          <div class="form-group">
            <label class="form-label" for="username">Email Address</label>
            <input
              id="username"
              type="email"
              class="form-input"
              placeholder="Enter Your Email Address"
              required
              v-model="username"
              autocomplete="username"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <div style="position: relative;">
              <input
                id="password"
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                style="padding-right: 45px;"
                placeholder="••••••••"
                required
                v-model="password"
                autocomplete="current-password"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                style="
                  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
                  background: none; border: none; cursor: pointer; font-size: 20px; opacity: 0.7;
                "
              >
                {{ showPassword ? '👁️' : '👁️‍🗨️' }}
              </button>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" :disabled="loading">
            {{ loading ? 'Authenticating...' : 'Sign In' }}
          </button>
        </form>
      </div>

      <div class="schoolFooter">
        Basic Education of Concepcion Holy Cross College, Inc.
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  position: relative;
  overflow: hidden;
  padding: 24px;
}

.bgGradient {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(30, 58, 95, 0.03) 0%, rgba(245, 166, 35, 0.03) 50%, rgba(30, 58, 95, 0.06) 100%);
  pointer-events: none;
}

.container {
  width: 100%;
  max-width: 440px;
  position: relative;
  z-index: 10;
  animation: entrance 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

@keyframes entrance {
  0% { opacity: 0; transform: translateY(40px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

.card {
  background: white;
  border-radius: 32px;
  border: 1.5px solid #edf2f7;
  padding: 56px 48px;
  box-shadow: 0 50px 100px -20px rgba(30, 58, 95, 0.1);
  text-align: center;
  position: relative;
  z-index: 10;
}

.header { margin-bottom: 32px; }

.logoImage {
  width: 110px;
  height: 110px;
  margin: 0 auto 24px;
  display: block;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 10px 30px rgba(30, 58, 95, 0.25);
  animation: popIn 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.3s backwards;
}

@keyframes popIn {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.title {
  font-size: 32px;
  font-weight: 950;
  color: #1e3a5f;
  letter-spacing: -0.05em;
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.subtitle {
  font-size: 11px;
  color: #1e3a5f;
  opacity: 0.7;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  line-height: 1.4;
}

.divider {
  height: 1.5px;
  background: #f1f5f9;
  width: 100%;
  margin: 32px 0;
}

.errorAlert {
  background: #fef2f2;
  border: 1.5px solid #ef4444;
  color: #ef4444;
  padding: 14px;
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 700;
  margin-bottom: 24px;
  animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@keyframes shake {
  10%, 90% { transform: translate3d(-1px, 0, 0); }
  20%, 80% { transform: translate3d(2px, 0, 0); }
  30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
  40%, 60% { transform: translate3d(4px, 0, 0); }
}

.form { text-align: left; }
.form :deep(.form-input) {
  background: #f8fafc !important;
  border: 1.5px solid #e2e8f0 !important;
  color: #1e3a5f !important;
}
.form :deep(.form-input::placeholder) { color: #94a3b8; }
.btn-full { width: 100%; padding: 14px; font-size: 15px; margin-top: 8px; }

.btn-primary {
  background: #1e3a5f;
  color: white;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: #f5a623;
  color: #1e3a5f;
  box-shadow: 0 8px 24px rgba(245, 166, 35, 0.35);
  transform: translateY(-2px);
}

.schoolFooter {
  margin-top: 24px;
  text-align: center;
  font-size: 11px;
  color: #6b7280;
  font-weight: 600;
  letter-spacing: 0.03em;
}

@media (max-width: 480px) {
  .card { padding: 32px 24px; }
}
</style>
