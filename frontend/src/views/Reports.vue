<script setup lang="ts">
import { ref } from 'vue';
import Topbar from '@/components/Topbar.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const reportType = ref<'daily' | 'weekly' | 'monthly'>('daily');
const selectedDate = ref(new Date().toISOString().slice(0, 10));
const selectedMonth = ref(new Date().getMonth() + 1);
const selectedYear = ref(new Date().getFullYear());

const loading = ref(false);
const reportData = ref<any>(null);

const generateReport = async () => {
  loading.value = true;
  reportData.value = null;
  try {
    let url = `/reports/attendance/${reportType.value}`;
    if (reportType.value === 'daily') {
      url += `?date=${selectedDate.value}`;
    } else if (reportType.value === 'weekly') {
      url += `?start_date=${selectedDate.value}`;
    } else if (reportType.value === 'monthly') {
      url += `?month=${selectedMonth.value}&year=${selectedYear.value}`;
    }

    const res = await api.get(url);
    if (res.success) {
      reportData.value = res.data;
    } else {
      toastStore.showToast(res.message || 'Failed to generate report', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Network error generating report', 'error');
  } finally {
    loading.value = false;
  }
};

const exportCSV = async () => {
  try {
    let url = `/reports/attendance/export/csv`;
    if (reportType.value === 'daily') {
      url += `?date=${selectedDate.value}`;
    } else if (reportType.value === 'weekly') {
      url += `?start_date=${selectedDate.value}`;
    } else if (reportType.value === 'monthly') {
      url += `?month=${selectedMonth.value}&year=${selectedYear.value}`;
    }

    // Since csv route returns text, let's hit it or parse it
    const res = await api.get(url);
    if (res.success && res.data) {
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Attendance_Report_${reportType.value}_${selectedDate.value}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toastStore.showToast('CSV downloaded successfully!', 'success');
    } else {
      // Fallback client-side generation
      generateClientCSV();
    }
  } catch {
    generateClientCSV();
  }
};

const generateClientCSV = () => {
  if (!reportData.value || !reportData.value.records) return;
  const records = reportData.value.records;
  
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Date,Student No,Name,Grade,Section,Time In,Time Out,Status\n";
  
  records.forEach((r: any) => {
    csvContent += `"${r.attendance_date}","${r.student_no}","${r.last_name}, ${r.first_name}","${r.grade_level}","${r.section}","${r.time_in || ''}","${r.time_out || ''}","${r.status}"\n`;
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Attendance_Report_${reportType.value}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toastStore.showToast('CSV generated and downloaded!', 'success');
};

const exportPDF = () => {
  window.print();
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};
</script>

<template>
  <div class="page-content">
    <Topbar title="Reports" subtitle="Attendance compilation & export tools" class="no-print" />

    <!-- Print Only Letterhead -->
    <div class="print-letterhead print-only">
      <div class="letterhead-title">BASIC EDUCATION OF CONCEPCION HOLY CROSS COLLEGE, INC.</div>
      <div class="letterhead-motto">Student Attendance Monitoring System</div>
      <div class="letterhead-sub">Concepcion, Tarlac, Philippines</div>
      <div class="divider" style="margin: 16px 0;" />
    </div>

    <!-- Configuration Card -->
    <div class="controls-card card no-print">
      <h2 class="section-title" style="margin-bottom: 20px;">Report Specifications</h2>
      <div class="filters-row">
        <div class="filter-group">
          <label>Report Scope</label>
          <select v-model="reportType" class="filter-select">
            <option value="daily">Daily Report</option>
            <option value="weekly">Weekly Report</option>
            <option value="monthly">Monthly Report</option>
          </select>
        </div>

        <div class="filter-group" v-if="reportType !== 'monthly'">
          <label>{{ reportType === 'daily' ? 'Report Date' : 'Week Start Date' }}</label>
          <input type="date" v-model="selectedDate" class="filter-input" />
        </div>

        <template v-else>
          <div class="filter-group">
            <label>Month</label>
            <select v-model="selectedMonth" class="filter-select">
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
            <input type="number" v-model="selectedYear" class="filter-input" />
          </div>
        </template>

        <div class="filter-group button-group">
          <button @click="generateReport" class="btn btn-primary" :disabled="loading">
            {{ loading ? 'Generating...' : 'Compile Report' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Compilation Outputs -->
    <div v-if="reportData" class="report-section" style="margin-top: 32px;">
      <!-- Action Bar -->
      <div class="action-bar no-print" style="margin-bottom: 24px; display: flex; justify-content: flex-end; gap: 12px;">
        <button @click="exportCSV" class="btn btn-secondary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export CSV</button>
        <button @click="exportPDF" class="btn btn-secondary"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 4px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print PDF</button>
      </div>

      <!-- Summary Stats Row -->
      <div class="summary-row" style="margin-bottom: 24px;">
        <div class="card summary-box present">
          <span class="box-label">Present</span>
          <span class="box-val">{{ reportData.summary?.present || 0 }}</span>
        </div>
        <div class="card summary-box late">
          <span class="box-label">Late</span>
          <span class="box-val">{{ reportData.summary?.late || 0 }}</span>
        </div>
        <div class="card summary-box absent">
          <span class="box-label">Absent</span>
          <span class="box-val">{{ reportData.summary?.absent || 0 }}</span>
        </div>
        <div class="card summary-box excused">
          <span class="box-label">Excused</span>
          <span class="box-val">{{ reportData.summary?.excused || 0 }}</span>
        </div>
      </div>

      <!-- Report Metadata -->
      <div class="report-metadata-header" style="margin-bottom: 20px;">
        <h3 class="compiled-title">
          Compiled Attendance Report: {{ reportType.toUpperCase() }}
        </h3>
        <p class="compiled-date" v-if="reportType === 'daily'">Date: {{ formatDate(reportData.date) }}</p>
        <p class="compiled-date" v-else-if="reportType === 'weekly'">Week range: {{ formatDate(reportData.start_date) }} to {{ formatDate(reportData.end_date) }}</p>
        <p class="compiled-date" v-else>Month of: {{ selectedMonth }}/{{ selectedYear }}</p>
      </div>

      <!-- Results Table -->
      <div class="card results-table-card">
        <table class="report-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Student No</th>
              <th>Student Name</th>
              <th>Grade & Section</th>
              <th>Time In</th>
              <th>Time Out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="reportData.records.length === 0">
              <td colspan="7" class="text-center py-5 text-muted">No attendance logs match constraints.</td>
            </tr>
            <tr v-else v-for="(r, idx) in reportData.records" :key="idx">
              <td>{{ r.attendance_date }}</td>
              <td>{{ r.student_no }}</td>
              <td>{{ r.last_name }}, {{ r.first_name }}</td>
              <td>{{ r.grade_level }} - {{ r.section }}</td>
              <td class="time-text">{{ r.time_in || '—' }}</td>
              <td class="time-text">{{ r.time_out || '—' }}</td>
              <td>
                <span class="badge" :class="r.status.toLowerCase()">{{ r.status }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Loading frame -->
    <div v-else-if="loading" class="spinner-container" style="margin-top: 60px;">
      <div class="spinner"></div>
    </div>

    <!-- Empty state -->
    <div v-else class="card empty-report no-print" style="margin-top: 32px; padding: 40px; text-align: center; color: var(--text-muted);">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
      <p style="margin-top: 12px; font-weight: 700;">Please specify specifications and compile to view report details.</p>
    </div>
  </div>
</template>

<style scoped>
.controls-card {
  padding: 24px;
  margin-top: 24px;
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
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 200px;
  flex: 1;
}

.button-group {
  flex: 0 0 auto;
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

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.summary-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 18px;
  border-radius: var(--radius-md);
  border: 1.5px solid var(--divider);
}

.box-label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.box-val {
  font-size: 24px;
  font-weight: 900;
  margin-top: 4px;
}

.summary-box.present { border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.02); }
.summary-box.present .box-val { color: #10b981; }

.summary-box.late { border-color: rgba(245, 158, 11, 0.2); background: rgba(245, 158, 11, 0.02); }
.summary-box.late .box-val { color: #d97706; }

.summary-box.absent { border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.02); }
.summary-box.absent .box-val { color: #ef4444; }

.summary-box.excused { border-color: rgba(59, 130, 246, 0.2); background: rgba(59, 130, 246, 0.02); }
.summary-box.excused .box-val { color: #3b82f6; }

.compiled-title {
  font-size: 18px;
  font-weight: 850;
  color: var(--primary-dark);
}

.compiled-date {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-muted);
  margin-top: 2px;
}

.results-table-card {
  padding: 0;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.report-table {
  width: 100%;
  border-collapse: collapse;
}

.report-table th {
  background: #f8fafc;
  color: var(--primary-dark);
  font-weight: 800;
  font-size: 13px;
  text-transform: uppercase;
  padding: 14px 20px;
  border-bottom: 1.5px solid var(--divider);
  text-align: left;
}

.report-table td {
  padding: 14px 20px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
  border-bottom: 1px solid var(--divider);
}

.time-text {
  font-weight: 700;
  color: var(--primary-dark);
}

.badge {
  font-size: 11px;
  font-weight: 900;
  padding: 3px 8px;
  border-radius: 9999px;
  text-transform: uppercase;
}

.badge.present { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.badge.late { background: rgba(245, 158, 11, 0.1); color: #d97706; }
.badge.absent { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.badge.excused { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

.spinner-container {
  display: flex;
  justify-content: center;
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

/* Print Only Styles */
.print-only {
  display: none;
}

@media print {
  .no-print {
    display: none !important;
  }
  .print-only {
    display: block !important;
  }
  .page-content {
    padding: 0 !important;
  }
  .card {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .report-table th {
    background: #eaeaea !important;
    color: black !important;
  }
  .report-table td {
    border-bottom: 1px solid #ddd !important;
  }
  .print-letterhead {
    text-align: center;
    margin-bottom: 24px;
  }
  .letterhead-title {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 0.05em;
  }
  .letterhead-motto {
    font-size: 12px;
    font-weight: 800;
    color: #555;
  }
  .letterhead-sub {
    font-size: 11px;
    color: #666;
  }
}
</style>
