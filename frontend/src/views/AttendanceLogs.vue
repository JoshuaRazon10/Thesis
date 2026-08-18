<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import { api } from '@/lib/api';

const columns = [
  { key: 'attendance_date', label: 'Date', sortable: true },
  { key: 'student_no', label: 'Student No', sortable: true },
  { key: 'student_name', label: 'Student Name', sortable: true },
  { key: 'grade_level', label: 'Grade', sortable: true },
  { key: 'section', label: 'Section', sortable: true },
  { key: 'time_in', label: 'Time In', sortable: false },
  { key: 'time_out', label: 'Time Out', sortable: false },
  { key: 'status', label: 'Status', sortable: true }
];

const logColumns = [
  { key: 'log_time', label: 'Log Time', sortable: true },
  { key: 'full_name', label: 'Name', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'log_type', label: 'Action', sortable: true },
  { key: 'guard_id', label: 'Verified By Guard', sortable: false }
];

const activeTab = ref<'records' | 'raw_logs'>('records');
const records = ref<any[]>([]);
const rawLogs = ref<any[]>([]);
const loading = ref(false);
const refreshInterval = ref<any>(null);

// Filters
const filterGrade = ref('');
const filterSection = ref('');
const filterStatus = ref('');
const filterDate = ref(new Date().toISOString().slice(0, 10));

const fetchRecords = async () => {
  loading.value = true;
  try {
    let url = `/attendance?date=${filterDate.value}`;
    if (filterGrade.value) url += `&grade_level=${filterGrade.value}`;
    if (filterSection.value) url += `&section=${filterSection.value}`;
    
    const res = await api.get(url);
    if (res.success) {
      records.value = res.data.map((r: any) => ({
        ...r,
        student_name: `${r.last_name}, ${r.first_name}`
      }));
    }
  } catch (err) {
    console.error('Failed to load records:', err);
  } finally {
    loading.value = false;
  }
};

const fetchRawLogs = async () => {
  loading.value = true;
  try {
    const res = await api.get('/attendance/logs');
    if (res.success) {
      rawLogs.value = (res.data || []).map((log: any) => {
        let fullName = 'Unknown';
        let role = 'Unknown';
        if (log.student_id) {
          fullName = `${log.student_last_name || ''}, ${log.student_first_name || ''}`;
          role = 'Student';
        } else if (log.teacher_id) {
          fullName = `${log.teacher_last_name || ''}, ${log.teacher_first_name || ''}`;
          role = 'Teacher';
        } else if (log.guard_id) {
          fullName = log.guard_name || 'Guard';
          role = 'Guard';
        }
        return {
          ...log,
          full_name: fullName,
          role: role
        };
      });
    }
  } catch (err) {
    console.error('Failed to load raw logs:', err);
  } finally {
    loading.value = false;
  }
};

const refreshData = () => {
  if (activeTab.value === 'records') {
    fetchRecords();
  } else {
    fetchRawLogs();
  }
};

const formatDate = (isoString: string) => {
  return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (isoString: string) => {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const filteredRecords = computed(() => {
  return records.value.filter((r) => {
    return !filterStatus.value || r.status.toLowerCase() === filterStatus.value.toLowerCase();
  });
});

onMounted(() => {
  refreshData();
  // Set up 30s auto-refresh
  refreshInterval.value = setInterval(refreshData, 30000);
});

onBeforeUnmount(() => {
  if (refreshInterval.value) clearInterval(refreshInterval.value);
});
</script>

<template>
  <div class="page-content">
    <Topbar title="Attendance Logs" subtitle="Basic Education of Concepcion Holy Cross College, Inc." />

    <!-- Tabs header -->
    <div class="tabs-bar">
      <button
        @click="activeTab = 'records'; refreshData();"
        :class="['tab-btn', { active: activeTab === 'records' }]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Daily Attendance Records
      </button>
      <button
        @click="activeTab = 'raw_logs'; refreshData();"
        :class="['tab-btn', { active: activeTab === 'raw_logs' }]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> Real-Time Gate Logs
      </button>
    </div>

    <!-- Filters Area (Records Tab Only) -->
    <div class="controls-card card" v-if="activeTab === 'records'">
      <div class="filters-row">
        <div class="filter-group">
          <label>Attendance Date</label>
          <input type="date" v-model="filterDate" class="filter-input" @change="fetchRecords" />
        </div>

        <div class="filter-group">
          <label>Grade Level</label>
          <select v-model="filterGrade" class="filter-select" @change="fetchRecords">
            <option value="">All Grades</option>
            <option value="Grade 1">Grade 1</option>
            <option value="Grade 2">Grade 2</option>
            <option value="Grade 3">Grade 3</option>
            <option value="Grade 4">Grade 4</option>
            <option value="Grade 5">Grade 5</option>
            <option value="Grade 6">Grade 6</option>
            <option value="Grade 7">Grade 7</option>
            <option value="Grade 8">Grade 8</option>
            <option value="Grade 9">Grade 9</option>
            <option value="Grade 10">Grade 10</option>
            <option value="Grade 11">Grade 11</option>
            <option value="Grade 12">Grade 12</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Section</label>
          <select v-model="filterSection" class="filter-select" @change="fetchRecords">
            <option value="">All Sections</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="Newton">Newton</option>
            <option value="Einstein">Einstein</option>
            <option value="Archimedes">Archimedes</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Attendance Status</label>
          <select v-model="filterStatus" class="filter-select">
            <option value="">All Statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="excused">Excused</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Data Tables -->
    <div class="table-section" style="margin-top: 24px;">
      <!-- Daily Records -->
      <DataTable
        v-if="activeTab === 'records'"
        :columns="columns"
        :data="filteredRecords"
        :loading="loading"
        searchPlaceholder="Search students in date records..."
      >
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

      <!-- Raw Entry Logs -->
      <DataTable
        v-else
        :columns="logColumns"
        :data="rawLogs"
        :loading="loading"
        searchPlaceholder="Search names or roles..."
      >
        <template #cell(log_time)="{ value }">
          <span class="time-text">{{ formatDate(value) }} {{ formatTime(value) }}</span>
        </template>
        <template #cell(log_type)="{ value }">
          <span class="log-badge" :class="value ? value.toLowerCase() : ''">
            <span v-if="value === 'IN'"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 2px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Time In</span>
            <span v-else><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 2px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Time Out</span>
          </span>
        </template>
        <template #cell(role)="{ value }">
          <span class="role-badge" :class="value ? value.toLowerCase() : ''">{{ value || 'Unknown' }}</span>
        </template>
        <template #cell(guard_id)="{ value }">
          {{ value ? `Guard ID #${value}` : 'Autoscan Gate' }}
        </template>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.tabs-bar {
  display: flex;
  gap: 12px;
  margin-top: 32px;
  border-bottom: 2px solid var(--divider);
  padding-bottom: 8px;
}

.tab-btn {
  background: transparent;
  border: none;
  font-family: inherit;
  font-size: 15px;
  font-weight: 800;
  color: var(--text-muted);
  padding: 12px 20px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition);
  position: relative;
}

.tab-btn:hover {
  color: var(--primary);
}

.tab-btn.active {
  color: var(--primary);
}

.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 0; right: 0;
  height: 3px;
  background: var(--accent); /* Gold color */
  border-radius: 9999px;
}

.controls-card {
  padding: 24px;
  margin-top: 24px;
}

.filters-row {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 200px;
  flex: 1;
}

.filter-group label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.filter-select, .filter-input {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--divider);
  font-family: inherit;
  font-weight: 600;
  background: white;
  outline: none;
  transition: var(--transition);
}

.filter-select:focus, .filter-input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(30, 58, 95, 0.08);
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

/* Raw log styling */
.log-badge {
  font-size: 12.5px;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  display: inline-block;
}

.log-badge.in {
  background: rgba(16, 185, 129, 0.08);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.log-badge.out {
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.role-badge {
  font-size: 11px;
  font-weight: 900;
  padding: 2px 8px;
  border-radius: 9999px;
  text-transform: uppercase;
}

.role-badge.student {
  background: rgba(30, 58, 95, 0.1);
  color: var(--primary);
}

.role-badge.teacher {
  background: rgba(245, 166, 35, 0.1);
  color: #d97706;
}
</style>
