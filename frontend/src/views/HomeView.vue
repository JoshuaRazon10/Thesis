<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const phase = ref<'intro' | 'zoom' | 'navigating'>('intro');

onMounted(() => {
  // 1. Initial brand reveal (0.6s)
  setTimeout(() => {
    phase.value = 'zoom';
  }, 600);

  // 2. Longer, smoother zoom duration (1.8s total from start)
  setTimeout(() => {
    phase.value = 'navigating';
    
    // Redirect logic
    if (authStore.loading) {
      authStore.init();
    }
    router.replace(authStore.user ? '/dashboard' : '/login');
  }, 1800);
});
</script>

<template>
  <div :style="{ 
    display: 'flex', 
    flexDirection: 'column',
    alignItems: 'center', 
    justifyContent: 'center', 
    minHeight: '100vh',
    background: 'white',
    position: 'fixed',
    top: 0, left: 0, width: '100%', height: '100%',
    zIndex: 999,
    pointerEvents: 'none',
    opacity: phase === 'navigating' ? 0 : 1,
    visibility: phase === 'navigating' ? 'hidden' : 'visible',
    transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.8s'
  }">
    <div :class="['splash-logo', { 'zoom-effect': phase === 'zoom' || phase === 'navigating' }]" style="margin-bottom: 32px">
      <div class="logo-circle">
        <span class="logo-text">CHCC</span>
      </div>
    </div>
    
    <div :class="['branding-text', { 'zoom-effect': phase === 'zoom' || phase === 'navigating' }]" style="text-align: center">
       <h1 style="font-size: 24px; font-weight: 900; color: #1e3a5f; letter-spacing: 0.08em; margin-bottom: 12px; text-transform: uppercase; max-width: 500px; line-height: 1.3;">BASIC EDUCATION OF CONCEPCION HOLY CROSS COLLEGE, INC.</h1>
       <p style="font-size: 14px; color: #f5a623; font-weight: 800; letter-spacing: 0.25em;">STUDENT ATTENDANCE MONITORING SYSTEM</p>
    </div>
  </div>
</template>

<style scoped>
.splash-logo {
  transition: transform 1.2s cubic-bezier(0.5, 0, 0.2, 1);
}
.branding-text {
  transition: transform 1.2s cubic-bezier(0.5, 0, 0.2, 1), opacity 0.8s ease;
}
.zoom-effect {
  transform: scale(10);
  opacity: 0;
}

.logo-circle {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: #1e3a5f;
  border: 6px solid #f5a623;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 25px 60px rgba(30, 58, 95, 0.25);
}

.logo-text {
  font-size: 48px;
  font-weight: 900;
  color: #f5a623;
  letter-spacing: 4px;
  font-family: 'Outfit', sans-serif;
}
</style>
