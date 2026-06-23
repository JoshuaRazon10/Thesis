<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import Sidebar from '@/components/Sidebar.vue';

const authStore = useAuthStore();
const router = useRouter();

onMounted(() => {
  if (authStore.loading) {
    authStore.init();
  }
  if (!authStore.user) {
    router.replace('/login');
  }
});
</script>

<template>
  <div v-if="authStore.loading" style="display: flex; align-items: center; justify-content: center; min-height: 100vh;">
    <div class="spinner" />
  </div>
  <div v-else-if="authStore.user" class="portal-layout">
    <Sidebar />
    <main class="portal-main">
      <router-view />
    </main>
  </div>
</template>
