<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = withDefaults(defineProps<{
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}>(), {
  type: 'success',
  duration: 3000
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const isVisible = ref(true);
let timer1: number;
let timer2: number;

const closeToast = () => {
  isVisible.value = false;
  timer2 = setTimeout(() => {
    emit('close');
  }, 400) as unknown as number;
};

onMounted(() => {
  timer1 = setTimeout(() => {
    closeToast();
  }, props.duration) as unknown as number;
});

onUnmounted(() => {
  clearTimeout(timer1);
  clearTimeout(timer2);
});
</script>

<template>
  <div :class="['toast', type, isVisible ? 'visible' : 'hidden']">
    <div class="icon">
      <svg v-if="type === 'success'" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.6666 5L7.49992 14.1667L3.33325 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else-if="type === 'error'" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="content">
      <p class="message">{{ message }}</p>
    </div>
    <button class="closeBtn" @click="closeToast">
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<style scoped>
.toast {
  position: relative;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 16px;
  background: white;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  border: 1.5px solid #edf2f7;
  z-index: 10000;
  min-width: 340px;
  max-width: 450px;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  backdrop-filter: blur(10px);
}

.visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.hidden {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
  pointer-events: none;
}

.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.success .icon {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.error .icon {
  background: rgba(239, 68, 68, 0.1);
  color: var(--danger);
}

.content {
  flex: 1;
}

.message {
  font-size: 13px;
  font-weight: 850;
  color: #1e3a5f;
  margin: 0;
  letter-spacing: -0.2px;
}

.closeBtn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  border-radius: 4px;
}

.closeBtn:hover {
  background: var(--secondary);
  color: var(--primary);
}

.success {
  border-left: 4px solid var(--success);
}

.error {
  border-left: 4px solid var(--danger);
}
</style>
