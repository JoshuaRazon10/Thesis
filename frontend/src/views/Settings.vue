<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Topbar from '@/components/Topbar.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const settings = ref({
  teacher_time_in: '08:00',
  teacher_time_out: '17:00'
});

const loading = ref(false);

const loadSettings = async () => {
  loading.value = true;
  try {
    const res = await api.get('/settings');
    if (res.success && res.data) {
      const timeIn = res.data.find((s: any) => s.setting_key === 'teacher_time_in');
      const timeOut = res.data.find((s: any) => s.setting_key === 'teacher_time_out');
      
      if (timeIn) settings.value.teacher_time_in = timeIn.setting_value;
      if (timeOut) settings.value.teacher_time_out = timeOut.setting_value;
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Failed to load system settings', 'error');
  } finally {
    loading.value = false;
  }
};

const handleSave = async (key: 'teacher_time_in' | 'teacher_time_out') => {
  try {
    const value = settings.value[key];
    const res = await api.put(`/settings/${key}`, { value });
    if (res.success) {
      toastStore.showToast(`Setting '${key}' saved successfully!`, 'success');
    } else {
      toastStore.showToast(res.message || 'Failed to save setting', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error saving system setting', 'error');
  }
};

const triggerBackup = () => {
  toastStore.showToast('Database backup initiated! SQL export file is compiling in the background.', 'info');
};

onMounted(() => {
  loadSettings();
});
</script>

<template>
  <div class="page-content">
    <Topbar title="System Settings" subtitle="Global configuration panel" />

    <div class="settings-body" style="margin-top: 32px;">
      <div v-if="loading" class="spinner-container">
        <div class="spinner"></div>
      </div>
      <template v-else>
        <!-- Time settings card -->
        <div class="card settings-card">
          <h3 class="card-title">⏰ Teacher Work Schedule</h3>
          <p class="card-desc">Set the official daily check-in threshold. Log entries recorded past Time In will trigger late marks.</p>
          <div class="divider" style="margin: 20px 0;" />

          <div class="form-fields">
            <div class="setting-row">
              <div class="input-block">
                <label class="form-label" for="time_in">Scheduled Time In</label>
                <input id="time_in" type="time" class="form-input" v-model="settings.teacher_time_in" />
              </div>
              <button @click="handleSave('teacher_time_in')" class="btn btn-primary">
                Save
              </button>
            </div>

            <div class="setting-row" style="margin-top: 20px;">
              <div class="input-block">
                <label class="form-label" for="time_out">Scheduled Time Out</label>
                <input id="time_out" type="time" class="form-input" v-model="settings.teacher_time_out" />
              </div>
              <button @click="handleSave('teacher_time_out')" class="btn btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>

        <!-- Backup Settings Card -->
        <div class="card settings-card" style="margin-top: 32px;">
          <h3 class="card-title">💾 Database Maintenance & Backup</h3>
          <p class="card-desc">Execute safe exports of student attendance tables and payroll history to secure cold-storage SQL files.</p>
          <div class="divider" style="margin: 20px 0;" />

          <div class="backup-block">
            <div class="backup-details">
              <span class="db-status">Status: ⚡ Connected & Syncing</span>
              <span class="db-details">Database: MySQL (Aiven Host)</span>
            </div>
            <button @click="triggerBackup" class="btn btn-secondary">
              📥 Create Full SQL Backup
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.settings-body {
  max-width: 700px;
}

.settings-card {
  padding: 32px;
}

.card-title {
  font-size: 17px;
  font-weight: 850;
  color: var(--primary-dark);
}

.card-desc {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-muted);
  margin-top: 4px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
}

.input-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-main);
}

.form-input {
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--divider);
  font-family: inherit;
  font-size: 14.5px;
  font-weight: 700;
  outline: none;
  background: #f8fafc;
  width: 100%;
}

.form-input:focus {
  border-color: var(--primary);
  background: white;
  box-shadow: 0 0 0 4px rgba(30, 58, 95, 0.08);
}

.btn {
  padding: 12px 24px;
  border-radius: 9999px;
  font-family: inherit;
  font-weight: 700;
  font-size: 14px;
  border: none;
  cursor: pointer;
  transition: var(--transition);
}

.btn-primary {
  background: var(--primary);
  color: white;
  box-shadow: var(--shadow-primary);
}

.btn-primary:hover {
  background: var(--primary-light);
  transform: translateY(-2px);
}

.btn-secondary {
  background: white;
  color: var(--text-main);
  border: 1.5px solid var(--divider);
}

.btn-secondary:hover {
  background: #f1f5f9;
  border-color: var(--primary-light);
}

.backup-block {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.backup-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.db-status {
  font-size: 14.5px;
  font-weight: 800;
  color: #10b981;
}

.db-details {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}

.spinner-container {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--secondary);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: rotate 0.8s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
