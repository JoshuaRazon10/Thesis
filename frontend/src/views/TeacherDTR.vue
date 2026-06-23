<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const route = useRoute();
const router = useRouter();
const toastStore = useToastStore();

const teacherId = route.params.id;
const teacher = ref<any>(null);
const timelogs = ref<any[]>([]);
const loading = ref(false);

const columns = [
  { key: 'log_date', label: 'Date', sortable: true },
  { key: 'time_in', label: 'Time In', sortable: false },
  { key: 'time_out', label: 'Time Out', sortable: false },
  { key: 'hours_worked', label: 'Hours Worked', sortable: false },
  { key: 'overtime_hours', label: 'Overtime', sortable: false },
  { key: 'late_minutes', label: 'Late (Mins)', sortable: false }
];

// Month and year selectors
const selectedMonth = ref(new Date().getMonth() + 1);
const selectedYear = ref(new Date().getFullYear());

const loadTeacherInfo = async () => {
  try {
    const res = await api.get(`/teachers/${teacherId}`);
    if (res.success) {
      teacher.value = res.data;
    } else {
      toastStore.showToast('Teacher not found', 'error');
      router.push('/teachers');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error loading teacher info', 'error');
  }
};

const loadTimelogs = async () => {
  loading.value = true;
  try {
    // Generate start and end date for the selected month/year
    const startStr = `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}-01`;
    const lastDay = new Date(selectedYear.value, selectedMonth.value, 0).getDate();
    const endStr = `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}-${lastDay}`;

    const res = await api.get(`/teachers/${teacherId}/timelogs?start_date=${startStr}&end_date=${endStr}`);
    if (res.success) {
      timelogs.value = res.data;
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error loading timelogs', 'error');
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

// Summary computations
const totalRegularHours = computed(() => {
  return timelogs.value.reduce((acc, log) => acc + (Number(log.regular_hours) || 0), 0);
});

const totalOvertimeHours = computed(() => {
  return timelogs.value.reduce((acc, log) => acc + (Number(log.overtime_hours) || 0), 0);
});

const totalLateMinutes = computed(() => {
  return timelogs.value.reduce((acc, log) => acc + (Number(log.late_minutes) || 0), 0);
});

const totalHoursWorked = computed(() => {
  return totalRegularHours.value + totalOvertimeHours.value;
});

onMounted(async () => {
  await loadTeacherInfo();
  loadTimelogs();
});
</script>

<template>
  <div class="page-content" v-if="teacher">
    <Topbar :title="`${teacher.last_name}, ${teacher.first_name} — DTR`" subtitle="Daily Time Record Logs" />

    <div class="controls-card card">
      <div class="header-row">
        <h2 class="section-title">Daily Time Record Selector</h2>
        <router-link to="/teachers" class="btn btn-secondary">
          ← Back to Teachers
        </router-link>
      </div>

      <div class="filters-row">
        <div class="filter-group">
          <label>Month</label>
          <select v-model="selectedMonth" class="filter-select" @change="loadTimelogs">
            <option :value="1">January</option>
            <option :value="2">February</option>
            <option :value="3">March</option>
            <option :value="4">April</option>
            <option :value="5">May</option>
            <option :value="6">June</option>
            <option :value="7">July</option>
            <option :value="8">August</option>
            <option :value="9">September</option>
            <option :value="10">October</option>
            <option :value="11">November</option>
            <option :value="12">December</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Year</label>
          <input type="number" v-model="selectedYear" class="filter-input" @change="loadTimelogs" />
        </div>
      </div>
    </div>

    <!-- DTR Table Card -->
    <div class="card table-card" style="margin-top: 24px; padding: 0; overflow: hidden;">
      <DataTable :columns="columns" :data="timelogs" :loading="loading" :searchable="false">
        <template #cell(log_date)="{ value }">
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
        <template #cell(hours_worked)="{ item }">
          <span class="hours-val">{{ (Number(item.regular_hours) + Number(item.overtime_hours)).toFixed(1) }} hrs</span>
        </template>
        <template #cell(overtime_hours)="{ value }">
          <span v-if="Number(value) > 0" class="ot-text">+{{ Number(value).toFixed(1) }} hrs</span>
          <span v-else class="time-dash">—</span>
        </template>
        <template #cell(late_minutes)="{ value }">
          <span v-if="Number(value) > 0" class="late-text">{{ value }} mins</span>
          <span v-else class="time-dash">—</span>
        </template>
      </DataTable>

      <!-- Bottom DTR Totals Summary Bar -->
      <div class="dtr-totals-bar" v-if="!loading && timelogs.length > 0">
        <div class="total-metric">
          <span class="metric-label">Total Hours:</span>
          <span class="metric-val">{{ totalHoursWorked.toFixed(1) }} hrs</span>
        </div>
        <div class="total-metric">
          <span class="metric-label">Regular Hours:</span>
          <span class="metric-val">{{ totalRegularHours.toFixed(1) }} hrs</span>
        </div>
        <div class="total-metric">
          <span class="metric-label">Overtime Hours:</span>
          <span class="metric-val text-ot">{{ totalOvertimeHours.toFixed(1) }} hrs</span>
        </div>
        <div class="total-metric">
          <span class="metric-label">Late Deductions:</span>
          <span class="metric-val text-late">{{ totalLateMinutes }} mins</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.controls-card {
  padding: 24px;
  margin-top: 32px;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--primary-dark);
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

.btn {
  padding: 10px 20px;
  border-radius: 9999px;
  font-family: inherit;
  font-weight: 700;
  font-size: 13.5px;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: var(--transition);
}

.btn-secondary {
  background: white;
  color: var(--text-main);
  border: 1.5px solid var(--divider);
}

.btn-secondary:hover {
  background: #f1f5f9;
}

.time-text {
  font-weight: 700;
  color: var(--primary-dark);
}

.time-dash {
  color: var(--text-muted);
  font-weight: 600;
}

.hours-val {
  font-weight: 700;
  color: var(--primary-dark);
}

.ot-text {
  font-weight: 800;
  color: #2563eb;
}

.late-text {
  font-weight: 800;
  color: var(--danger);
}

.dtr-totals-bar {
  display: flex;
  justify-content: space-around;
  background: #f8fafc;
  padding: 20px 24px;
  border-top: 2px solid var(--divider);
  flex-wrap: wrap;
  gap: 16px;
}

.total-metric {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-label {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.metric-val {
  font-size: 16.5px;
  font-weight: 900;
  color: var(--primary-dark);
}

.text-ot {
  color: #2563eb;
}

.text-late {
  color: var(--danger);
}
</style>
