<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
// Removed unused import

defineProps<{
  title: string;
  subtitle?: string;
}>();

const authStore = useAuthStore();
const now = new Date();
const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const dateInput = ref<HTMLInputElement | null>(null);
const openCalendar = () => {
  if (dateInput.value) {
    if ('showPicker' in HTMLInputElement.prototype) {
      try {
        dateInput.value.showPicker();
      } catch (e) {
        dateInput.value.focus();
      }
    } else {
      dateInput.value.focus();
    }
  }
};

// Removed unused initials
</script>

<template>
  <header class="topbar">
    <div class="left">
      <h1 class="title">{{ title }}</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
    </div>
    <div class="right">
      <div class="datePill" @click="openCalendar" style="cursor: pointer; position: relative;">
        <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span>
        {{ dateStr }}
        <input type="date" ref="dateInput" style="position: absolute; width: 0; height: 0; opacity: 0; padding: 0; margin: 0; border: none; bottom: -10px; left: 50%; transform: translateX(-50%); pointer-events: none;" />
      </div>
      <div class="userPill">
        <span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
        Administrator
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 40px;
  background: white;
  border-bottom: 1.5px solid var(--divider);
  position: sticky;
  top: 0;
  z-index: 50;
  transition: all 0.3s ease;
  backdrop-filter: blur(8px);
}

.left { display: flex; flex-direction: column; gap: 4px; }

.title {
  font-size: 20px;
  font-weight: 800;
  color: var(--primary-dark);
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.right { display: flex; align-items: center; gap: 24px; }

.datePill {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  background: var(--secondary);
  padding: 8px 16px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
}

.datePill:hover {
  background: rgba(30, 58, 95, 0.05);
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 4px 10px rgba(30, 58, 95, 0.1);
}

.datePill:active {
  transform: scale(0.96);
  background: rgba(30, 58, 95, 0.1);
}

.userPill {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-dark);
  background: white;
  border: 1px solid var(--divider);
  box-shadow: 0 1px 3px rgba(30, 58, 95, 0.05);
  padding: 7px 16px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: default;
  user-select: none;
}

@media (max-width: 1024px) {
  .topbar { padding: 12px 20px 12px 70px; min-height: 70px; }
  .right { gap: 12px; }
  .datePill { display: none; }
}

@media (max-width: 600px) {
  .topbar { padding: 12px 16px 12px 80px; }
  .title { font-size: 15px; }
  .subtitle { display: none; }
  .pillName { display: none; }
  .userPill { padding: 4px; }
}
</style>
