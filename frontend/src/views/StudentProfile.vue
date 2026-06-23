<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const route = useRoute();
const router = useRouter();
const toastStore = useToastStore();

const studentId = route.params.id;

const student = ref<any>(null);
const parent = ref<any>(null);
const attendanceLogs = ref<any[]>([]);
const loading = ref(true);

const columns = [
  { key: 'attendance_date', label: 'Date', sortable: true },
  { key: 'time_in', label: 'Time In', sortable: false },
  { key: 'time_out', label: 'Time Out', sortable: false },
  { key: 'status', label: 'Status', sortable: true }
];

const loadProfileData = async () => {
  loading.value = true;
  try {
    // 1. Fetch Student Details
    const studentRes = await api.get(`/students/${studentId}`);
    if (studentRes.success) {
      student.value = studentRes.data;
    } else {
      toastStore.showToast('Student not found', 'error');
      router.push('/students');
      return;
    }

    // 2. Fetch Parent Details (Filter from all parents)
    const parentsRes = await api.get('/parents');
    if (parentsRes.success) {
      parent.value = parentsRes.data.find((p: any) => p.student_id === Number(studentId)) || null;
    }

    // 3. Fetch Attendance History
    const attendanceRes = await api.get(`/attendance?student_id=${studentId}`);
    if (attendanceRes.success) {
      attendanceLogs.value = attendanceRes.data;
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error loading student profile', 'error');
  } finally {
    loading.value = false;
  }
};

const formatDate = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};

onMounted(() => {
  loadProfileData();
});
</script>

<template>
  <div class="page-content" v-if="student">
    <Topbar :title="`${student.last_name}, ${student.first_name}`" subtitle="Student Profile & Attendance History" />

    <div class="profile-layout" style="margin-top: 32px;">
      <!-- Profile Card -->
      <div class="card detail-card">
        <div class="profile-header-block">
          <div class="avatar-circle">
            <img v-if="student.face_encoding" :src="student.face_encoding" alt="Face registered" class="face-img" />
            <span v-else class="face-placeholder">👤</span>
          </div>
          <div class="header-text">
            <div class="student-name-title">{{ student.first_name }} {{ student.last_name }}</div>
            <div class="student-no-subtitle">ID: {{ student.student_no }}</div>
            <span class="status-badge active" v-if="student.status === 'active'">Active Student</span>
            <span class="status-badge inactive" v-else>Inactive</span>
          </div>
        </div>

        <div class="divider" />

        <div class="info-grid">
          <div class="info-group">
            <span class="info-label">Grade Level</span>
            <span class="info-val">{{ student.grade_level }}</span>
          </div>
          <div class="info-group">
            <span class="info-label">Section</span>
            <span class="info-val">{{ student.section }}</span>
          </div>
          <div class="info-group">
            <span class="info-label">School Branch</span>
            <span class="info-val">Basic Education</span>
          </div>
          <div class="info-group">
            <span class="info-label">Biometric ID status</span>
            <span class="info-val" :style="{ color: student.face_encoding ? '#10b981' : '#f5a623', fontWeight: '800' }">
              {{ student.face_encoding ? '✅ Registered' : '⚠️ Unregistered' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Parent & Guardian Contact Card -->
      <div class="card parent-card">
        <h3 class="card-title">Parent & Guardian Contact</h3>
        <div class="divider" style="margin: 16px 0;" />

        <div v-if="parent" class="parent-info-block">
          <div class="parent-name">{{ parent.guardian_name }}</div>
          <p class="relation-text">Registered Legal Guardian</p>

          <div class="contact-pill" style="margin-top: 16px;">
            <span class="phone-icon">📞</span>
            <span class="phone-no">{{ parent.contact_no }}</span>
          </div>
          <p class="sms-notif-msg">
            🔔 SAMS will automatically dispatch SMS notifications to this contact number during morning entry and afternoon departures.
          </p>
        </div>
        <div v-else class="empty-parent-block">
          <span class="warning-icon">⚠️</span>
          <p class="no-parent-text">No Parent/Guardian linked to this profile.</p>
          <router-link to="/parents" class="link-btn" style="margin-top: 12px; display: inline-block;">
            Link Guardian details →
          </router-link>
        </div>
      </div>
    </div>

    <!-- Attendance History Table -->
    <div class="card table-card" style="margin-top: 32px;">
      <h3 class="card-title">Attendance Logs</h3>
      <div class="divider" style="margin: 16px 0;" />

      <DataTable :columns="columns" :data="attendanceLogs" :loading="loading" :searchable="false">
        <template #cell(attendance_date)="{ value }">
          {{ formatDate(value) }}
        </template>
        <template #cell(time_in)="{ value }">
          <span v-if="value" class="time-text">{{ value }}</span>
          <span v-else class="time-dash">—</span>
        </template>
        <template #cell(time_out)="{ value }">
          <span v-if="value" class="time-text">{{ value }}</span>
          <span v-else class="time-dash">—</span>
        </template>
        <template #cell(status)="{ value }">
          <span class="badge" :class="value.toLowerCase()">{{ value }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.profile-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 32px;
  align-items: start;
}

@media (max-width: 900px) {
  .profile-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

.profile-header-block {
  display: flex;
  align-items: center;
  gap: 24px;
}

.avatar-circle {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: var(--secondary);
  border: 4px solid white;
  box-shadow: var(--shadow-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.face-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.face-placeholder {
  font-size: 40px;
}

.header-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.student-name-title {
  font-size: 22px;
  font-weight: 900;
  color: var(--primary-dark);
}

.student-no-subtitle {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-muted);
}

.status-badge {
  font-size: 11px;
  font-weight: 900;
  padding: 4px 10px;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 4px;
}

.status-badge.active {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-badge.inactive {
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.info-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.info-val {
  font-size: 15px;
  font-weight: 800;
  color: var(--primary-dark);
}

.card-title {
  font-size: 16.5px;
  font-weight: 800;
  color: var(--primary-dark);
}

.parent-info-block .parent-name {
  font-size: 18px;
  font-weight: 850;
  color: var(--primary-dark);
}

.relation-text {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
  margin-top: 2px;
}

.contact-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--secondary);
  padding: 10px 18px;
  border-radius: 9999px;
}

.phone-icon {
  font-size: 14px;
}

.phone-no {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--primary);
}

.sms-notif-msg {
  font-size: 12.5px;
  color: var(--text-muted);
  font-weight: 600;
  line-height: 1.5;
  margin-top: 16px;
}

.empty-parent-block {
  text-align: center;
  padding: 24px 0;
  color: var(--text-muted);
}

.warning-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.no-parent-text {
  font-size: 13.5px;
  font-weight: 700;
}

.link-btn {
  color: var(--primary);
  font-weight: 800;
  text-decoration: none;
  font-size: 13.5px;
}

.link-btn:hover {
  text-decoration: underline;
}

.time-text {
  font-weight: 700;
  color: var(--primary-dark);
}

.time-dash {
  color: var(--text-muted);
  font-weight: 600;
}

.badge {
  font-size: 11.5px;
  font-weight: 900;
  padding: 4px 10px;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: inline-block;
}

.badge.present {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.badge.late {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.badge.absent {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.badge.excused {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}
</style>
