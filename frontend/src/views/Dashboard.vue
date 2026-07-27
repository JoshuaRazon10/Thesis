<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Topbar from '@/components/Topbar.vue';
import StatCard from '@/components/StatCard.vue';
import { api } from '@/lib/api';

const summary = ref({
  present: 0,
  absent: 0,
  teachers_in: 0,
  pending_sms: 0
});

const recentLogs = ref<any[]>([]);
const loading = ref(true);

const fetchDashboardData = async () => {
  loading.value = true;
  try {
    // Fetch summary
    const summaryRes = await api.get('/attendance/today/summary');
    if (summaryRes.success) {
      summary.value.present = summaryRes.data.present;
      summary.value.absent = summaryRes.data.absent;
      summary.value.teachers_in = summaryRes.data.teachers_in;
    }

    // Fetch pending sms count
    const smsRes = await api.get('/sms/pending');
    if (smsRes.success) {
      summary.value.pending_sms = smsRes.data.pending_count;
    }

    // Fetch recent logs
    const logsRes = await api.get('/attendance/logs');
    if (logsRes.success) {
      recentLogs.value = logsRes.data.slice(0, 10);
    }
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
  } finally {
    loading.value = false;
  }
};

const formatTime = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

onMounted(() => {
  fetchDashboardData();
});
</script>

<template>
  <div class="page-content">
    <Topbar title="Dashboard" subtitle="Student Attendance Monitoring System" />

    <div class="dashboard-body">
      <!-- Stats Grid -->
      <div class="grid-4">
        <StatCard
          title="Students Present Today"
          :value="summary.present"
          icon="✅"
          color="#10b981"
          subtitle="Checked in at school"
          :loading="loading"
        />
        <StatCard
          title="Students Absent Today"
          :value="summary.absent"
          icon="❌"
          color="#ef4444"
          subtitle="Not checked in"
          :loading="loading"
        />
        <StatCard
          title="Teachers Clocked In"
          :value="summary.teachers_in"
          icon="👩‍🏫"
          color="#2563eb"
          subtitle="Currently active"
          :loading="loading"
        />
        <StatCard
          title="Pending SMS Alerts"
          :value="summary.pending_sms"
          icon="📱"
          color="#f5a623"
          subtitle="Outbox queue size"
          :loading="loading"
        />
      </div>

      <!-- Main Section -->
      <div class="main-section">
        <!-- Live Feed Card -->
        <div class="card feed-card">
          <div class="feed-header">
            <h2 class="section-title">Recent Activity Logs</h2>
            <button @click="fetchDashboardData" class="refresh-btn">
              🔄 Refresh Feed
            </button>
          </div>
          <div class="divider" style="margin: 16px 0;" />

          <div v-if="loading" class="spinner-container">
            <div class="spinner"></div>
          </div>
          <div v-else-if="recentLogs.length === 0" class="empty-feed">
            <span class="empty-icon">🔔</span>
            <p>No activity logs recorded today.</p>
          </div>
          <div v-else class="logs-feed">
            <div
              v-for="log in recentLogs"
              :key="log.log_id"
              class="feed-item"
              :class="log.log_type.toLowerCase()"
            >
              <div class="badge" :class="log.log_type.toLowerCase()">
                {{ log.log_type }}
              </div>
              <div class="details">
                <p class="actor-name">
                  {{ log.full_name }}
                  <span class="actor-role">({{ log.role }})</span>
                </p>
                <p class="metadata-line">
                  Checked {{ log.log_type.toLowerCase() }} by Guard #{{ log.guard_id || 'System' }}
                </p>
              </div>
              <div class="time-stamp">
                <span class="date">{{ formatDate(log.log_time) }}</span>
                <span class="time">{{ formatTime(log.log_time) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- School info sidebar card -->
        <div class="card info-sidebar">
          <div class="branding-header">
            <span class="badge gold">CHCC Portal</span>
            <h3>Basic Education Portal</h3>
            <p class="school-motto">Concepcion Holy Cross College, Inc.</p>
          </div>
          <div class="divider" style="margin: 20px 0;" />
          
          <div class="quick-links">
            <p class="links-title">Quick Actions</p>
            <router-link to="/students" class="link-item">🎓 Register New Student</router-link>
            <router-link to="/teachers" class="link-item">👩‍🏫 Clock In Teacher</router-link>
            <router-link to="/payroll" class="link-item">💰 Process Payroll</router-link>
            <router-link to="/reports" class="link-item">📊 Attendance Reports</router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-body {
  display: flex;
  flex-direction: column;
  gap: 32px;
  margin-top: 32px;
}

.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@media (max-width: 1200px) {
  .grid-4 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 680px) {
  .grid-4 {
    grid-template-columns: 1fr;
  }
}

.main-section {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 32px;
  align-items: start;
}

@media (max-width: 1024px) {
  .main-section {
    grid-template-columns: 1fr;
  }
}

.section-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--primary-dark);
}

.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.refresh-btn {
  background: transparent;
  border: 1px solid var(--divider);
  padding: 8px 16px;
  border-radius: 9999px;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--transition);
}

.refresh-btn:hover {
  background: var(--secondary);
  color: var(--primary);
  border-color: var(--primary);
}

.spinner-container {
  display: flex;
  justify-content: center;
  padding: 60px 0;
}

.empty-feed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 24px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 32px;
}

.empty-feed p {
  font-weight: 600;
  font-size: 14.5px;
}

.logs-feed {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
}

.feed-item {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  background: #f8fafc;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--divider);
  gap: 16px;
  transition: var(--transition);
}

.feed-item:hover {
  transform: translateX(4px);
  border-color: rgba(30, 58, 95, 0.15);
}

.badge {
  font-size: 11px;
  font-weight: 900;
  padding: 4px 10px;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge.in {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.badge.out {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.badge.gold {
  background: rgba(245, 166, 35, 0.1);
  color: #f5a623;
  width: fit-content;
}

.details {
  flex: 1;
}

.actor-name {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--primary-dark);
}

.actor-role {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-left: 4px;
}

.metadata-line {
  font-size: 12.5px;
  color: var(--text-muted);
  font-weight: 500;
  margin-top: 2px;
}

.time-stamp {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
}

.time {
  font-size: 13.5px;
  color: var(--primary-dark);
}

.info-sidebar {
  padding: 32px;
  background: var(--primary-dark);
  color: white;
}

.branding-header h3 {
  font-size: 20px;
  font-weight: 900;
  margin-top: 12px;
}

.school-motto {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 4px;
}

.quick-links {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.links-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.link-item {
  color: white;
  text-decoration: none;
  font-size: 14.5px;
  font-weight: 700;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: var(--transition);
}

.link-item:hover {
  background: var(--accent);
  color: var(--primary-dark);
  transform: translateY(-2px);
}
</style>
