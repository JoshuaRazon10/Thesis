<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Topbar from '@/components/Topbar.vue';
import StatCard from '@/components/StatCard.vue';
import { api } from '@/lib/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
} from 'chart.js';
import { Line, Doughnut } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
);

const summary = ref({
  present: 0,
  total_students: 0,
  parents_inside: 0,
  teachers_in: 0,
  total_teachers: 0,
  pending_sms: 0,
  primaryCount: 0,
  secondaryCount: 0,
  visiting_meeting: 0,
  visiting_fetching: 0
});

const recentLogs = ref<any[]>([]);
const loading = ref(true);

const chartData = ref({
  labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  datasets: [
    {
      label: 'Students Present',
      backgroundColor: 'rgba(234, 88, 12, 0.2)',
      borderColor: '#ea580c',
      pointRadius: 0,
      pointHoverRadius: 5,
      borderWidth: 3,
      tension: 0.4,
      fill: true,
      data: [320, 340, 310, 350, 335]
    }
  ]
});

const chartOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false }
  },
  scales: {
    x: { display: false },
    y: { display: false, beginAtZero: true, suggestedMax: 400 }
  }
});

const doughnutData = ref({
  labels: ['Clock In', 'Sick', 'Excused', 'Other'],
  datasets: [
    {
      backgroundColor: ['#1e3a5f', '#93c5fd', '#f59e0b', '#fcd34d'],
      data: [55, 2, 2, 1]
    }
  ]
});

const doughnutOptions = ref({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: {
      display: false
    }
  }
});

const fetchDashboardData = async () => {
  loading.value = true;
  try {
    // Fetch summary
    const summaryRes = await api.get('/attendance/today/summary');
    if (summaryRes.success) {
      const d = summaryRes.data;
      summary.value.present = d.present_count || d.present || 0;
      summary.value.total_students = d.total_students || 0;
      summary.value.parents_inside = d.parents_inside || 0;
      summary.value.teachers_in = d.teachers_clocked_in || d.teachers_in || 0;
      summary.value.total_teachers = d.total_teachers || 0;

      // Update student breakdown for legend
      summary.value.primaryCount = d.students_breakdown?.primary || 0;
      summary.value.secondaryCount = d.students_breakdown?.secondary || 0;

      // Update weekly chart data
      if (d.weekly_chart) {
        chartData.value.labels = d.weekly_chart.labels;
        chartData.value.datasets[0].data = d.weekly_chart.data;
      }

      // Update teacher doughnut chart data
      if (d.teacher_status) {
        doughnutData.value.datasets[0].data = [
          d.teacher_status.clock_in,
          d.teacher_status.sick,
          d.teacher_status.excused,
          d.teacher_status.other
        ];
      }
      
      // Update visiting reasons
      summary.value.visiting_meeting = d.parents_breakdown?.meeting || 0;
      summary.value.visiting_fetching = d.parents_breakdown?.fetching || 0;
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
      <div class="grid-3">
        <!-- Card 1 -->
        <StatCard
          title="Students Present Today"
          :value="summary.present.toLocaleString()"
          :total="summary.total_students.toLocaleString()"
          icon='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
          color="#16a34a"
          :loading="loading"
        >
          <div class="progress-bar-wrap">
            <div class="progress-bar" style="background-color: #16a34a" :style="{ width: (summary.present / summary.total_students * 100) + '%' }"></div>
          </div>
          <div class="card-chart-label">Students count</div>
          <div style="height: 90px; margin-top: 4px; position: relative;">
            <Line :data="chartData" :options="chartOptions" />
          </div>
          <div class="chart-legend-dots" style="margin-top: 8px;">
            <span class="dot-item"><span class="dot" style="background:#93c5fd"></span>Primary: {{ summary.primaryCount }}</span>
            <span class="dot-item"><span class="dot" style="background:#60a5fa"></span>Secondary: {{ summary.secondaryCount }}</span>
          </div>
        </StatCard>

        <!-- Card 2 -->
        <StatCard
          title="Parents Inside School"
          :value="summary.parents_inside.toString()"
          icon='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>'
          color="#ef4444"
          :loading="loading"
        >
          <div class="progress-bar-wrap">
            <div class="progress-bar" style="background-color: #ef4444; width: 10%;"></div>
          </div>
          <div class="card-chart-label" style="margin-bottom: 8px;">Visiting reasons</div>
          <div class="visiting-reasons">
            <div class="reason-item">
              <span><span class="dot" style="background:#1e3a5f"></span> Meeting</span>
              <span class="reason-count">({{ summary.visiting_meeting }})</span>
            </div>
            <div class="reason-item">
              <span><span class="dot" style="background:#ef4444"></span> Fetching</span>
              <span class="reason-count">({{ summary.visiting_fetching }})</span>
            </div>
          </div>
        </StatCard>

        <!-- Card 3 -->
        <StatCard
          title="Teachers Clocked In"
          :value="summary.teachers_in.toString()"
          :total="summary.total_teachers.toString()"
          icon='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>'
          color="#1e3a5f"
          :loading="loading"
        >
          <div class="progress-bar-wrap">
            <div class="progress-bar" style="background-color: #93c5fd" :style="{ width: (summary.teachers_in / summary.total_teachers * 100) + '%' }"></div>
          </div>
          <div class="card-chart-label">Status</div>
          <div style="height: 100px; margin-top: 8px; position: relative;">
            <Doughnut :data="doughnutData" :options="doughnutOptions" />
          </div>
        </StatCard>
      </div>

      <!-- Main Section -->
      <div class="main-section">
        <div class="main-left">
          <!-- Live Feed Card -->
        <div class="card feed-card">
          <div class="feed-header">
            <h2 class="section-title">Recent Activity Logs</h2>
            <button @click="fetchDashboardData" class="refresh-btn" style="display: flex; align-items: center; gap: 6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>Refresh Feed</span>
            </button>
          </div>
          <div class="divider" style="margin: 16px 0;" />

          <div v-if="loading" class="spinner-container">
            <div class="spinner"></div>
          </div>
          <div v-else-if="recentLogs.length === 0" class="empty-feed">
            <div class="empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); opacity: 0.6;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </div>
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
        </div> <!-- Close main-left -->

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
            <router-link to="/students" class="link-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              Register New Student
            </router-link>
            <router-link to="/teachers" class="link-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Clock In Teacher
            </router-link>
            <router-link to="/payroll" class="link-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
              Process Payroll
            </router-link>
            <router-link to="/reports" class="link-item">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
              Attendance Reports
            </router-link>
          </div>

          <div class="divider" style="margin: 20px 0;" />

          <div class="sms-badge">
            <div class="sms-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="sms-info">
              <span class="sms-title">Pending SMS Alerts</span>
              <span class="sms-count">{{ summary.pending_sms }} in queue</span>
            </div>
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

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

@media (max-width: 1200px) {
  .grid-3 {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 680px) {
  .grid-3 {
    grid-template-columns: 1fr;
  }
}

.progress-bar-wrap {
  width: 100%;
  height: 6px;
  background: #f1f5f9;
  border-radius: 4px;
  margin: 16px 0 12px 0;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: 4px;
}

.card-chart-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 600;
}

.chart-legend-dots {
  display: flex;
  justify-content: center;
  gap: 16px;
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 600;
}

.dot-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.visiting-reasons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.reason-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13.5px;
  color: var(--primary-dark);
  font-weight: 600;
}

.reason-count {
  color: var(--text-muted);
  font-weight: 600;
}

.sms-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: var(--radius-md);
  border: 1px solid var(--divider);
}

.sms-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(30,58,95,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-dark);
}

.sms-info {
  display: flex;
  flex-direction: column;
}

.sms-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary-dark);
}

.sms-count {
  font-size: 12px;
  color: var(--text-muted);
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
  display: flex;
  align-items: center;
  gap: 10px;
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
