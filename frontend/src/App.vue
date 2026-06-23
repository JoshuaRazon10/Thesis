<script setup lang="ts">
import { onMounted } from 'vue';
import Toast from '@/components/Toast.vue';
import { useToastStore } from '@/stores/toast';
import { useAuthStore } from '@/stores/auth';

const toastStore = useToastStore();
const authStore = useAuthStore();

onMounted(() => {
  authStore.init();
});
</script>

<template>
  <div>
    <!-- Main View Routing Frame -->
    <router-view />

    <!-- Global Floating Toast Notification System -->
    <div style="position: fixed; bottom: 32px; right: 32px; z-index: 9999; pointer-events: none; display: flex; flex-direction: column-reverse; gap: 12px;">
      <div v-for="toast in toastStore.toasts" :key="toast.id" style="pointer-events: auto;">
        <Toast 
          :message="toast.message" 
          :type="toast.type" 
          @close="toastStore.removeToast(toast.id)" 
        />
      </div>
    </div>
  </div>
</template>
