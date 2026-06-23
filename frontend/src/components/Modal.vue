<script setup lang="ts">
import { watch, onUnmounted } from 'vue';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
}>(), {
  type: 'info',
  confirmText: 'Proceed',
  cancelText: 'Cancel'
});

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

watch(() => props.isOpen, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = 'auto';
  }
}, { immediate: true });

onUnmounted(() => {
  document.body.style.overflow = 'auto';
});
</script>

<template>
  <div v-if="isOpen" class="overlay">
    <div class="modal animate-in">
      <div class="header">
        <div :class="['iconWrapper', type]">
          <span v-if="type === 'danger'">⚠️</span>
          <span v-else-if="type === 'warning'">🔔</span>
          <span v-else-if="type === 'success'">✅</span>
          <span v-else-if="type === 'info'">ℹ️</span>
        </div>
        <h2 class="title">{{ title }}</h2>
      </div>

      <div class="body">
        <p class="message">{{ message }}</p>
      </div>

      <div class="footer">
        <button class="cancelBtn" @click="emit('cancel')">
          {{ cancelText }}
        </button>
        <button
          :class="['confirmBtn', `btn-${type}`]"
          @click="emit('confirm')"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal {
  background: #fff;
  border-radius: 24px;
  width: 100%;
  max-width: 440px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.header {
  padding: 32px 32px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.iconWrapper {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 20px;
}

.danger {
  background: #fee2e2;
  color: #ef4444;
}

.warning {
  background: #fef3c7;
  color: #f59e0b;
}

.success {
  background: #d1fae5;
  color: #10b981;
}

.info {
  background: #e0e7ff;
  color: #6366f1;
}

.title {
  font-size: 20px;
  font-weight: 900;
  color: #1e293b;
  margin: 0;
}

.body {
  padding: 0 32px 32px;
  text-align: center;
}

.message {
  font-size: 15px;
  line-height: 1.6;
  color: #64748b;
  margin: 0;
}

.footer {
  padding: 16px 32px 32px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.cancelBtn {
  background: #f1f5f9;
  color: #475569;
  border: none;
  padding: 14px;
  border-radius: 12px;
  font-weight: 800;
  cursor: pointer;
}

.confirmBtn {
  border: none;
  padding: 14px;
  border-radius: 12px;
  font-weight: 800;
  color: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger {
  background: #ef4444;
}

.btn-danger:hover {
  background: #dc2626;
  transform: translateY(-2px);
}

.btn-warning {
  background: #f59e0b;
}

.btn-warning:hover {
  background: #d97706;
  transform: translateY(-2px);
}

.btn-success {
  background: #10b981;
}

.btn-success:hover {
  background: #059669;
  transform: translateY(-2px);
}

.btn-info {
  background: #6366f1;
}

.btn-info:hover {
  background: #4f46e5;
  transform: translateY(-2px);
}
</style>
