<script setup lang="ts">
defineProps<{
  title: string;
  value: string | number;
  total?: string | number;
  icon: string;
  color?: string; // hex or rgb color (e.g., #10b981)
  subtitle?: string;
  loading?: boolean;
}>();
</script>

<template>
  <div class="stat-card" :style="{ '--accent-color': color || 'var(--primary)' }">
    <div v-if="loading" class="skeleton-wrapper">
      <div class="skeleton title-skeleton"></div>
      <div class="skeleton value-skeleton"></div>
      <div class="skeleton subtitle-skeleton"></div>
    </div>
    <template v-else>
      <div class="card-content">
        <div class="header">
          <span class="card-title">{{ title }}</span>
          <div class="icon-badge">
            <span class="icon-text" v-html="icon"></span>
          </div>
        </div>
        <div class="value-container">
          <div class="card-value-wrap">
            <span class="card-value">{{ value }}</span>
            <span v-if="total" class="card-total">/{{ total }}</span>
          </div>
          <span v-if="subtitle" class="card-subtitle">{{ subtitle }}</span>
        </div>
        <div class="card-slot">
          <slot></slot>
        </div>
      </div>
      <!-- Decorative background glow -->
      <div class="card-glow"></div>
    </template>
  </div>
</template>

<style scoped>
.stat-card {
  position: relative;
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid var(--divider);
  padding: 24px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: var(--transition);
}

.stat-card:hover {
  transform: translateY(-5px);
  border-color: rgba(30, 58, 95, 0.15);
  box-shadow: 0 12px 24px -10px rgba(30, 58, 95, 0.15);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.card-title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.icon-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: rgba(30, 58, 95, 0.04);
  color: var(--accent-color);
  font-size: 20px;
  transition: var(--transition);
}

.stat-card:hover .icon-badge {
  transform: scale(1.05) rotate(5deg);
}

.value-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-value-wrap {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.card-value {
  font-size: 32px;
  font-weight: 900;
  color: var(--primary-dark);
  letter-spacing: -0.03em;
  line-height: 1;
}

.card-total {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-muted);
}

.card-subtitle {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-muted);
}

.card-slot {
  margin-top: 16px;
}

/* Decorative Glow */
.card-glow {
  position: absolute;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--accent-color);
  opacity: 0.03;
  right: -40px;
  bottom: -40px;
  filter: blur(20px);
  pointer-events: none;
  transition: var(--transition);
}

.stat-card:hover .card-glow {
  opacity: 0.08;
  transform: scale(1.2);
}

/* Skeleton Loading styles */
.skeleton-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: var(--radius-sm);
}

.title-skeleton {
  height: 16px;
  width: 40%;
}

.value-skeleton {
  height: 36px;
  width: 60%;
}

.subtitle-skeleton {
  height: 14px;
  width: 80%;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
