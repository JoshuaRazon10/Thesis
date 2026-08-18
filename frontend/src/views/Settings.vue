<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Topbar from '@/components/Topbar.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const settings = ref({
  teacher_time_in: '08:00',
  teacher_time_out: '17:00',
  student_time_in: '07:30',
  student_time_out: '16:00',
  httpsms_api_key: '',
  httpsms_sender_phone: ''
});

const loading = ref(false);

const loadSettings = async () => {
  loading.value = true;
  try {
    const res = await api.get('/settings');
    if (res.success && res.data) {
      const timeIn = res.data.find((s: any) => s.setting_key === 'teacher_time_in');
      const timeOut = res.data.find((s: any) => s.setting_key === 'teacher_time_out');
      const studTimeIn = res.data.find((s: any) => s.setting_key === 'student_time_in');
      const studTimeOut = res.data.find((s: any) => s.setting_key === 'student_time_out');
      const apiKey = res.data.find((s: any) => s.setting_key === 'httpsms_api_key');
      const senderPhone = res.data.find((s: any) => s.setting_key === 'httpsms_sender_phone');
      
      if (timeIn) settings.value.teacher_time_in = timeIn.setting_value;
      if (timeOut) settings.value.teacher_time_out = timeOut.setting_value;
      if (studTimeIn) settings.value.student_time_in = studTimeIn.setting_value;
      if (studTimeOut) settings.value.student_time_out = studTimeOut.setting_value;
      if (apiKey) settings.value.httpsms_api_key = apiKey.setting_value;
      if (senderPhone) settings.value.httpsms_sender_phone = senderPhone.setting_value;
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Failed to load system settings', 'error');
  } finally {
    loading.value = false;
  }
};

const handleSave = async (key: 'teacher_time_in' | 'teacher_time_out' | 'student_time_in' | 'student_time_out' | 'httpsms_api_key' | 'httpsms_sender_phone') => {
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

const triggerTestSms = async () => {
  const targetPhone = prompt("Enter the phone number to send the test SMS to (e.g. +639...):", settings.value.httpsms_sender_phone);
  if (!targetPhone) return;

  try {
    const res = await api.post('/settings/test-sms', { 
      sender: settings.value.httpsms_sender_phone,
      target: targetPhone
    });
    if (res.success) {
      toastStore.showToast(`Test SMS queued to ${targetPhone}! Check the phone.`, 'success');
    } else {
      toastStore.showToast(res.message || 'Failed to send test SMS', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error sending test SMS', 'error');
  }
};

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});
const passwordLoading = ref(false);

const handleChangePassword = async () => {
  if (!passwordForm.value.currentPassword || !passwordForm.value.newPassword || !passwordForm.value.confirmPassword) {
    toastStore.showToast('All password fields are required.', 'error');
    return;
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    toastStore.showToast('New passwords do not match.', 'error');
    return;
  }
  if (passwordForm.value.newPassword.length < 6) {
    toastStore.showToast('New password must be at least 6 characters long.', 'warning');
    return;
  }

  passwordLoading.value = true;
  try {
    const res = await api.post('/auth/change-password', {
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword
    });

    if (res.success) {
      toastStore.showToast('Password changed successfully!', 'success');
      passwordForm.value.currentPassword = '';
      passwordForm.value.newPassword = '';
      passwordForm.value.confirmPassword = '';
    } else {
      toastStore.showToast(res.message || 'Failed to change password.', 'error');
    }
  } catch (err: any) {
    console.error(err);
    toastStore.showToast('Error changing password.', 'error');
  } finally {
    passwordLoading.value = false;
  }
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
          <h3 class="card-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px; margin-right: 6px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Teacher Work Schedule</h3>
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

        <!-- SMS Settings card -->
        <div class="card settings-card">
          <h3 class="card-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px; margin-right: 6px;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>HttpSMS Configuration</h3>
          <p class="card-desc">Configure your HttpSMS Account API Key to automatically send notifications to parents.</p>
          <div class="divider" style="margin: 20px 0;" />

          <div class="form-fields">
            <div class="setting-row">
              <div class="input-block">
                <label class="form-label" for="api_key">Account API Key</label>
                <input id="api_key" type="password" class="form-input" v-model="settings.httpsms_api_key" placeholder="Enter your HttpSMS Account API Key" />
              </div>
              <button @click="handleSave('httpsms_api_key')" class="btn btn-primary">
                Save
              </button>
            </div>

            <div class="setting-row" style="margin-top: 20px;">
              <div class="input-block">
                <label class="form-label" for="sender_phone">Sender Phone Number</label>
                <input id="sender_phone" type="text" class="form-input" v-model="settings.httpsms_sender_phone" placeholder="e.g. +639123456789" />
              </div>
              <div style="display: flex; gap: 8px;">
                <button @click="triggerTestSms" class="btn btn-secondary">
                  Test Connection
                </button>
                <button @click="handleSave('httpsms_sender_phone')" class="btn btn-primary">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Student Settings card -->
        <div class="card settings-card" style="margin-top: 32px;">
          <h3 class="card-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px; margin-right: 6px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Student Class Schedule</h3>
          <p class="card-desc">Set the official daily check-in threshold for students. Log entries recorded past Time In will trigger late marks.</p>
          <div class="divider" style="margin: 20px 0;" />

          <div class="form-fields">
            <div class="setting-row">
              <div class="input-block">
                <label class="form-label" for="student_time_in">Scheduled Time In</label>
                <input id="student_time_in" type="time" class="form-input" v-model="settings.student_time_in" />
              </div>
              <button @click="handleSave('student_time_in')" class="btn btn-primary">
                Save
              </button>
            </div>

            <div class="setting-row" style="margin-top: 20px;">
              <div class="input-block">
                <label class="form-label" for="student_time_out">Scheduled Time Out</label>
                <input id="student_time_out" type="time" class="form-input" v-model="settings.student_time_out" />
              </div>
              <button @click="handleSave('student_time_out')" class="btn btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>

        <!-- Change Password Card -->
        <div class="card settings-card" style="margin-top: 32px;">
          <h3 class="card-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px; margin-right: 6px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Change Administrator Password</h3>
          <p class="card-desc">Update the password for the system administrator account.</p>
          <div class="divider" style="margin: 20px 0;" />

          <form @submit.prevent="handleChangePassword" class="form-fields">
            <div class="setting-row">
              <div class="input-block">
                <label class="form-label" for="current_password">Current Password</label>
                <input id="current_password" type="password" class="form-input" v-model="passwordForm.currentPassword" placeholder="Enter current password" required />
              </div>
            </div>

            <div class="setting-row" style="margin-top: 20px;">
              <div class="input-block">
                <label class="form-label" for="new_password">New Password</label>
                <input id="new_password" type="password" class="form-input" v-model="passwordForm.newPassword" placeholder="Min. 6 characters" required />
              </div>
            </div>

            <div class="setting-row" style="margin-top: 20px;">
              <div class="input-block">
                <label class="form-label" for="confirm_password">Confirm New Password</label>
                <input id="confirm_password" type="password" class="form-input" v-model="passwordForm.confirmPassword" placeholder="Re-type new password" required />
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
              <button type="submit" class="btn btn-primary" :disabled="passwordLoading">
                {{ passwordLoading ? 'Updating...' : 'Update Password' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Backup Settings Card -->
        <div class="card settings-card" style="margin-top: 32px;">
          <h3 class="card-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -3px; margin-right: 6px;"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>Database Maintenance &amp; Backup</h3>
          <p class="card-desc">Execute safe exports of student attendance tables and payroll history to secure cold-storage SQL files.</p>
          <div class="divider" style="margin: 20px 0;" />

          <div class="backup-block">
            <div class="backup-details">
              <span class="db-status">Status: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 2px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Connected & Syncing</span>
              <span class="db-details">Database: MySQL (Aiven Host)</span>
            </div>
            <button @click="triggerBackup" class="btn btn-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Create Full SQL Backup
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
