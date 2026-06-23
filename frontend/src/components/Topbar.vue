<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { computed } from 'vue';

defineProps<{
  title: string;
  subtitle?: string;
}>();

const authStore = useAuthStore();
const now = new Date();
const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const initials = computed(() => {
  const name = authStore.user?.full_name || '';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
});
</script>

<template>
  <header class="topbar">
    <div class="left">
      <h1 class="title">{{ title }}</h1>
      <p v-if="subtitle" class="subtitle">{{ subtitle }}</p>
    </div>
    <div class="right">
      <div class="datePill">
        <span>📅</span>
        {{ dateStr }}
      </div>
      <div class="userPill">
        <div class="pillAvatar">
          {{ initials }}
        </div>
        <span class="pillName">{{ authStore.user?.full_name?.split(' ')[0] }}</span>
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
}

.userPill {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px 6px 6px;
  background: #f8fafc;
  border: 1px solid var(--divider);
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.userPill:hover {
  background: white;
  border-color: rgba(30, 58, 95, 0.2);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.05);
}

.pillAvatar {
  width: 34px; height: 34px;
  border-radius: 50%;
  background: var(--primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 800;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(30, 58, 95, 0.2);
}

.pillName {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.01em;
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
