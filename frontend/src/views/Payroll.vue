<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const periodColumns = [
  { key: 'period_name', label: 'Period Name', sortable: true },
  { key: 'start_date', label: 'Start Date', sortable: true },
  { key: 'end_date', label: 'End Date', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'actions', label: 'Actions', sortable: false, width: '220px' }
];

const recordColumns = [
  { key: 'teacher_name', label: 'Teacher', sortable: true },
  { key: 'hourly_rate', label: 'Rate (₱)', sortable: false },
  { key: 'hours_worked', label: 'Regular/OT Hours', sortable: false },
  { key: 'gross_pay', label: 'Gross Pay', sortable: false },
  { key: 'total_deductions', label: 'Total Deductions', sortable: false },
  { key: 'net_pay', label: 'Net Pay', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false, width: '160px' }
];

const periods = ref<any[]>([]);
const loading = ref(false);

// Expanded Period details
const selectedPeriod = ref<any>(null);
const periodRecords = ref<any[]>([]);
const recordsLoading = ref(false);

// Create Period Modal
const showPeriodModal = ref(false);
const periodForm = ref({
  period_name: '',
  start_date: '',
  end_date: ''
});

// View Computation Modal
const showViewModal = ref(false);
const viewingRecord = ref<any>(null);
const dailyLogs = ref<any[]>([]);

const openViewRecord = async (record: any) => {
  viewingRecord.value = record;
  dailyLogs.value = [];
  // Parse deductions_details if it's a string
  if (typeof record.deductions_details === 'string') {
    try { viewingRecord.value.deductions_details = JSON.parse(record.deductions_details); } catch { viewingRecord.value.deductions_details = []; }
  }
  showViewModal.value = true;

  try {
    const res = await api.get(`/payroll/records/${record.payroll_id}/timelogs`);
    if (res.success) {
      dailyLogs.value = res.data || [];
    }
  } catch (err) {
    console.error('Error loading timelogs:', err);
  }
};

const formatDailyDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const printComputation = () => {
  window.print();
};

const handleSendSMS = async (payrollId: number) => {
  try {
    const res = await api.post(`/payroll/records/${payrollId}/send-sms`, {});
    if (res.success) {
      toastStore.showToast('Salary breakdown SMS sent to teacher!', 'success');
    } else {
      toastStore.showToast(res.message || 'Failed to send SMS', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error sending SMS', 'error');
  }
};

// Edit Record Modal
const showRecordModal = ref(false);
const editingRecord = ref<any>(null);
const recordForm = ref({
  regular_hours: 0,
  overtime_hours: 0,
  total_deductions: 0,
  net_pay: 0
});

const loadPeriods = async () => {
  loading.value = true;
  try {
    const res = await api.get('/payroll/periods');
    if (res.success) {
      periods.value = res.data;
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error fetching payroll periods', 'error');
  } finally {
    loading.value = false;
  }
};

const openCreatePeriod = () => {
  periodForm.value = {
    period_name: '',
    start_date: '',
    end_date: ''
  };
  showPeriodModal.value = true;
};

const handleCreatePeriod = async () => {
  try {
    const res = await api.post('/payroll/periods', periodForm.value);
    if (res.success) {
      toastStore.showToast('Payroll period created!', 'success');
      showPeriodModal.value = false;
      loadPeriods();
    } else {
      toastStore.showToast(res.message || 'Failed to create period', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error creating payroll period', 'error');
  }
};

const handleGeneratePayroll = async (periodId: number) => {
  loading.value = true;
  try {
    const res = await api.post(`/payroll/periods/${periodId}/generate`, {});
    if (res.success) {
      toastStore.showToast('Payroll generated successfully!', 'success');
      loadPeriods();
      if (selectedPeriod.value && selectedPeriod.value.period_id === periodId) {
        viewPeriodDetails(selectedPeriod.value);
      }
    } else {
      toastStore.showToast(res.message || 'Failed to generate payroll', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error generating payroll', 'error');
  } finally {
    loading.value = false;
  }
};

const viewPeriodDetails = async (period: any) => {
  selectedPeriod.value = period;
  recordsLoading.value = true;
  try {
    const res = await api.get(`/payroll/periods/${period.period_id}`);
    if (res.success) {
      periodRecords.value = (res.data.records || []).map((r: any) => ({
        ...r,
        teacher_name: `${r.last_name}, ${r.first_name}`
      }));
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error loading period records', 'error');
  } finally {
    recordsLoading.value = false;
  }
};

const openEditRecord = (record: any) => {
  editingRecord.value = record;
  recordForm.value = {
    regular_hours: Number(record.regular_hours),
    overtime_hours: Number(record.overtime_hours),
    total_deductions: Number(record.total_deductions),
    net_pay: Number(record.net_pay)
  };
  showRecordModal.value = true;
};

// Auto-recalculate Net Pay in form
const recalculateFormNetPay = () => {
  if (!editingRecord.value) return;
  const rate = Number(editingRecord.value.hourly_rate) || 0;
  const gross = (recordForm.value.regular_hours * rate) + (recordForm.value.overtime_hours * rate * 1.25);
  recordForm.value.net_pay = Math.max(0, gross - recordForm.value.total_deductions);
};

const handleSaveRecord = async () => {
  if (!editingRecord.value) return;
  try {
    const res = await api.put(`/payroll/records/${editingRecord.value.payroll_id}`, recordForm.value);
    if (res.success) {
      toastStore.showToast('Payroll record updated!', 'success');
      showRecordModal.value = false;
      if (selectedPeriod.value) {
        viewPeriodDetails(selectedPeriod.value);
      }
    } else {
      toastStore.showToast(res.message || 'Failed to update record', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error saving record', 'error');
  }
};

const handleFinalizePeriod = async (periodId: number) => {
  if (!confirm('Are you sure you want to finalize this payroll period? This will lock all details and generate PDF payslips for download.')) return;
  try {
    const res = await api.post(`/payroll/periods/${periodId}/finalize`, {});
    if (res.success) {
      toastStore.showToast('Payroll finalized and locked!', 'success');
      loadPeriods();
      if (selectedPeriod.value && selectedPeriod.value.period_id === periodId) {
        selectedPeriod.value.status = 'finalized';
        viewPeriodDetails(selectedPeriod.value);
      }
    } else {
      toastStore.showToast(res.message || 'Failed to finalize payroll', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error finalizing payroll', 'error');
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

onMounted(() => {
  loadPeriods();
});
</script>

<template>
  <div class="page-content">
    <Topbar title="Payroll" subtitle="Teacher Salary Processing Panel" />

    <div class="controls-card card">
      <div class="header-row">
        <h2 class="section-title">Payroll Period Tracking</h2>
        <button @click="openCreatePeriod" class="btn btn-primary">
          ➕ New Payroll Period
        </button>
      </div>
      <p class="section-tip">
        Create semi-monthly periods, scan teacher timecards within dates, review earnings and deductions, and finalize runs to release payslips.
      </p>
    </div>

    <!-- Periods List Table -->
    <div class="table-section" style="margin-top: 24px;">
      <DataTable :columns="periodColumns" :data="periods" :loading="loading" :searchable="false">
        <template #cell(start_date)="{ value }">
          {{ formatDate(value) }}
        </template>
        <template #cell(end_date)="{ value }">
          {{ formatDate(value) }}
        </template>
        <template #cell(status)="{ value }">
          <span class="badge" :class="value.toLowerCase()">{{ value }}</span>
        </template>
        <template #cell(actions)="{ item }">
          <div class="actions-wrapper" style="display: flex; gap: 6px;">
            <button @click="viewPeriodDetails(item)" class="action-btn-sm details-btn" style="display: inline-flex; align-items: center; gap: 4px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>View</span>
            </button>
            <button
              v-if="item.status === 'draft'"
              @click="handleGeneratePayroll(item.period_id)"
              class="action-btn-sm calc-btn"
              style="display: inline-flex; align-items: center; gap: 4px;"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
              <span>Compute</span>
            </button>
            <button
              v-if="item.status === 'draft'"
              @click="handleFinalizePeriod(item.period_id)"
              class="action-btn-sm lock-btn"
              style="display: inline-flex; align-items: center; gap: 4px;"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>Lock</span>
            </button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Selected Period details (Expandable section below) -->
    <div v-if="selectedPeriod" class="card period-detail-section" style="margin-top: 32px;">
      <div class="detail-header-row">
        <div>
          <h3 class="detail-title">Payroll Summary: {{ selectedPeriod.period_name }}</h3>
          <p class="detail-dates">
            Duration: {{ formatDate(selectedPeriod.start_date) }} to {{ formatDate(selectedPeriod.end_date) }}
            | Status: <strong :style="{ color: selectedPeriod.status === 'draft' ? '#f5a623' : '#10b981' }">{{ selectedPeriod.status.toUpperCase() }}</strong>
          </p>
        </div>
        <button
          v-if="selectedPeriod.status === 'draft' && periodRecords.length > 0"
          @click="handleFinalizePeriod(selectedPeriod.period_id)"
          class="btn btn-primary lock-big-btn"
          style="display: inline-flex; align-items: center; gap: 8px;"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Finalize & Post Payslips</span>
        </button>
      </div>
      <div class="divider" style="margin: 20px 0;" />

      <div v-if="recordsLoading" class="spinner-container">
        <div class="spinner"></div>
      </div>
      <div v-else-if="periodRecords.length === 0" class="empty-records">
        <span>💰</span>
        <p>No payroll records computed yet for this period.</p>
        <button
          v-if="selectedPeriod.status === 'draft'"
          @click="handleGeneratePayroll(selectedPeriod.period_id)"
          class="btn btn-primary"
          style="margin-top: 12px;"
        >
          Compute Teacher Hours & Net Pay Now
        </button>
      </div>
      <div v-else class="records-table-wrapper">
        <DataTable :columns="recordColumns" :data="periodRecords" :searchable="true" searchPlaceholder="Filter teachers...">
          <template #cell(hourly_rate)="{ value }">
            ₱{{ Number(value).toFixed(2) }}
          </template>
          <template #cell(hours_worked)="{ item }">
            {{ Number(item.regular_hours).toFixed(1) }}h / <span class="ot-text">{{ Number(item.overtime_hours).toFixed(1) }}h</span>
          </template>
          <template #cell(gross_pay)="{ value }">
            ₱{{ Number(value).toFixed(2) }}
          </template>
          <template #cell(total_deductions)="{ value }">
            <span :class="{ 'deduct-text': Number(value) > 0 }">₱{{ Number(value).toFixed(2) }}</span>
          </template>
          <template #cell(net_pay)="{ value }">
            <strong>₱{{ Number(value).toFixed(2) }}</strong>
          </template>
          <template #cell(actions)="{ item }">
            <div class="actions-wrapper" style="display: flex; gap: 6px;">
              <button
                @click="openViewRecord(item)"
                class="action-btn-sm details-btn"
                title="View salary computation"
                style="display: inline-flex; align-items: center; gap: 4px;"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>View</span>
              </button>
              <button
                @click="openEditRecord(item)"
                class="edit-row-btn"
                :disabled="selectedPeriod.status !== 'draft'"
                title="Edit Salary values manually"
                style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0;"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
            </div>
          </template>
        </DataTable>
      </div>
    </div>

    <!-- Create Period Modal -->
    <div v-if="showPeriodModal" class="modal-overlay">
      <div class="modal-container card animate-pop" style="max-width: 450px;">
        <div class="modal-header">
          <h3>Create Payroll Period</h3>
          <button @click="showPeriodModal = false" class="close-modal-btn">✕</button>
        </div>
        <div class="divider" style="margin: 16px 0;" />

        <form @submit.prevent="handleCreatePeriod" class="modal-form">
          <div class="form-fields">
            <div class="form-group">
              <label for="period_name" class="form-label">Period Description Name</label>
              <input id="period_name" type="text" class="form-input" v-model="periodForm.period_name" placeholder="e.g. June 1-15, 2026" required />
            </div>
            <div class="form-group">
              <label for="start_date" class="form-label">Start Date</label>
              <input id="start_date" type="date" class="form-input" v-model="periodForm.start_date" required />
            </div>
            <div class="form-group">
              <label for="end_date" class="form-label">End Date</label>
              <input id="end_date" type="date" class="form-input" v-model="periodForm.end_date" required />
            </div>
          </div>

          <div class="divider" style="margin: 24px 0 16px 0;" />
          <div class="form-actions">
            <button type="button" @click="showPeriodModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Period</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Record Modal -->
    <div v-if="showRecordModal" class="modal-overlay">
      <div class="modal-container card animate-pop" style="max-width: 450px;">
        <div class="modal-header">
          <h3>Adjust Payroll Earnings</h3>
          <button @click="showRecordModal = false" class="close-modal-btn">✕</button>
        </div>
        <div class="divider" style="margin: 16px 0;" />
        <p class="target-teacher-tag" v-if="editingRecord">Teacher: <strong>{{ editingRecord.teacher_name }}</strong></p>

        <form @submit.prevent="handleSaveRecord" class="modal-form" style="margin-top: 16px;">
          <div class="form-fields">
            <div class="form-group-row">
              <div class="form-group">
                <label for="reg_hours" class="form-label">Regular Hours</label>
                <input id="reg_hours" type="number" step="0.1" class="form-input" v-model="recordForm.regular_hours" @input="recalculateFormNetPay" required />
              </div>
              <div class="form-group">
                <label for="ot_hours" class="form-label">Overtime Hours</label>
                <input id="ot_hours" type="number" step="0.1" class="form-input" v-model="recordForm.overtime_hours" @input="recalculateFormNetPay" required />
              </div>
            </div>

            <div class="form-group-row">
              <div class="form-group">
                <label for="total_ded" class="form-label">Total Deductions (SSS, PhilHealth, etc.)</label>
                <input id="total_ded" type="number" step="0.01" class="form-input" v-model="recordForm.total_deductions" @input="recalculateFormNetPay" required />
              </div>
            </div>

            <div class="form-group">
              <label for="net_pay" class="form-label">Calculated Net Pay (PHP)</label>
              <input id="net_pay" type="number" step="0.01" class="form-input" v-model="recordForm.net_pay" required style="font-weight: 800; background: #f0fdf4; border-color: #86efac;" />
            </div>
          </div>

          <div class="divider" style="margin: 24px 0 16px 0;" />
          <div class="form-actions">
            <button type="button" @click="showRecordModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Adjustments</button>
          </div>
        </form>
      </div>
    </div>

    <!-- View Computation Modal (Printable) -->
    <div v-if="showViewModal && viewingRecord" class="modal-overlay computation-print-area">
      <div class="modal-container card animate-pop computation-modal" style="max-width: 620px;">
        <div class="modal-header no-print">
          <h3>Salary Computation</h3>
          <button @click="showViewModal = false" class="close-modal-btn">✕</button>
        </div>

        <!-- Printable Content -->
        <div class="computation-content" id="printable-computation">
          <div class="comp-letterhead">
            <img src="/images/chcc_circle.png" alt="CHCC Logo" class="print-logo" />
            <div class="letterhead-text">
              <div class="comp-school">BASIC EDUCATION OF CONCEPCION HOLY CROSS COLLEGE, INC.</div>
              <div class="comp-school-sub">Concepcion, Tarlac, Philippines</div>
              <div class="comp-doc-title">SALARY COMPUTATION SLIP</div>
            </div>
          </div>
          <div class="divider" />

          <div class="comp-meta">
            <div class="comp-meta-row">
              <span class="comp-label">Teacher Name:</span>
              <span class="comp-val"><strong>{{ viewingRecord.teacher_name }}</strong></span>
            </div>
            <div class="comp-meta-row">
              <span class="comp-label">Payroll Period:</span>
              <span class="comp-val">{{ selectedPeriod?.period_name }} ({{ formatDate(selectedPeriod?.start_date) }} – {{ formatDate(selectedPeriod?.end_date) }})</span>
            </div>
            <div class="comp-meta-row">
              <span class="comp-label">Days Present:</span>
              <span class="comp-val">{{ viewingRecord.days_worked }} day(s)</span>
            </div>
            <div class="comp-meta-row">
              <span class="comp-label">Hourly Rate:</span>
              <span class="comp-val">₱{{ Number(viewingRecord.hourly_rate).toFixed(2) }}</span>
            </div>
          </div>
          <div class="divider" />

          <!-- Daily Hours Breakdown -->
          <div v-if="dailyLogs.length > 0">
            <h4 class="comp-section-title">📅 Daily Hours Breakdown</h4>
            <div class="daily-hours-list">
              <span class="daily-hour-pill" v-for="log in dailyLogs" :key="log.log_date">
                {{ formatDailyDate(log.log_date) }} ({{ Number(log.hours_worked).toFixed(1) }} hrs)
              </span>
            </div>
            <div class="divider" />
          </div>

          <!-- Earnings Table -->
          <h4 class="comp-section-title">💰 Earnings</h4>
          <table class="comp-table">
            <thead>
              <tr><th>Description</th><th>Hours</th><th>Rate</th><th>Amount</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Regular Hours</td>
                <td>{{ Number(viewingRecord.regular_hours).toFixed(1) }} hrs</td>
                <td>₱{{ Number(viewingRecord.hourly_rate).toFixed(2) }}</td>
                <td>₱{{ (Number(viewingRecord.regular_hours) * Number(viewingRecord.hourly_rate)).toFixed(2) }}</td>
              </tr>
              <tr v-if="Number(viewingRecord.overtime_hours) > 0">
                <td>Overtime Hours (1.25×)</td>
                <td>{{ Number(viewingRecord.overtime_hours).toFixed(1) }} hrs</td>
                <td>₱{{ (Number(viewingRecord.hourly_rate) * 1.25).toFixed(2) }}</td>
                <td>₱{{ (Number(viewingRecord.overtime_hours) * Number(viewingRecord.hourly_rate) * 1.25).toFixed(2) }}</td>
              </tr>
              <tr class="comp-total-row">
                <td colspan="3"><strong>Gross Pay</strong></td>
                <td><strong>₱{{ Number(viewingRecord.gross_pay).toFixed(2) }}</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- Deductions Table -->
          <h4 class="comp-section-title" style="margin-top: 20px;">📋 Deductions</h4>
          <table class="comp-table">
            <thead>
              <tr><th>Type</th><th>Amount</th></tr>
            </thead>
            <tbody>
              <tr v-for="(ded, idx) in (viewingRecord.deductions_details || [])" :key="idx">
                <td>{{ ded.name }}</td>
                <td class="text-danger">-₱{{ Number(ded.amount).toFixed(2) }}</td>
              </tr>
              <tr v-if="!viewingRecord.deductions_details?.length">
                <td colspan="2" style="text-align:center; color: var(--text-muted);">No deductions</td>
              </tr>
              <tr class="comp-total-row">
                <td><strong>Total Deductions</strong></td>
                <td class="text-danger"><strong>-₱{{ Number(viewingRecord.total_deductions).toFixed(2) }}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="divider" style="margin: 18px 0;" />

          <!-- Net Pay -->
          <div class="comp-net-block">
            <span class="comp-net-label">NET PAY (Take-Home)</span>
            <span class="comp-net-amount">₱{{ Number(viewingRecord.net_pay).toFixed(2) }}</span>
          </div>

          <!-- Signatures -->
          <div class="comp-signatures">
            <div class="comp-sig">
              <div class="comp-sig-line"></div>
              <span>Faculty Signature</span>
            </div>
            <div class="comp-sig">
              <div class="comp-sig-line"></div>
              <span>Authorized Signatory</span>
            </div>
          </div>
        </div>

        <div class="divider no-print" style="margin: 16px 0;" />
        <div class="form-actions no-print">
          <button type="button" @click="showViewModal = false" class="btn btn-secondary">Close</button>
          <button type="button" @click="handleSendSMS(viewingRecord.payroll_id)" class="btn btn-secondary" style="border-color: var(--primary); color: var(--primary);">
            💬 Send SMS
          </button>
          <button type="button" @click="printComputation" class="btn btn-primary">🖨️ Print</button>
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
  margin-bottom: 8px;
}

.section-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--primary-dark);
}

.section-tip {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-muted);
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
  background: #f1f5f9;
  color: var(--text-main);
  border: 1.5px solid var(--divider);
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.actions-wrapper {
  display: flex;
  gap: 8px;
}

.action-btn-sm {
  padding: 6px 12px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  border-radius: var(--radius-sm);
  border: 1px solid var(--divider);
  cursor: pointer;
  background: white;
  transition: var(--transition);
}

.details-btn { color: var(--primary); }
.details-btn:hover { background: var(--secondary); border-color: var(--primary); }

.calc-btn { color: #d97706; }
.calc-btn:hover { background: rgba(245, 158, 11, 0.05); border-color: #d97706; }

.lock-btn { color: #10b981; }
.lock-btn:hover { background: rgba(16, 185, 129, 0.05); border-color: #10b981; }

.badge {
  font-size: 11px;
  font-weight: 900;
  padding: 4px 10px;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: inline-block;
}

.badge.draft { background: rgba(245, 158, 11, 0.1); color: #d97706; }
.badge.finalized { background: rgba(16, 185, 129, 0.1); color: #10b981; }

/* Expanded details styling */
.period-detail-section {
  box-shadow: var(--shadow-md);
  border-color: rgba(30, 58, 95, 0.12);
}

.detail-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.detail-title {
  font-size: 18px;
  font-weight: 850;
  color: var(--primary-dark);
}

.detail-dates {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-muted);
  margin-top: 4px;
}

.lock-big-btn {
  background: #10b981;
}

.lock-big-btn:hover {
  background: #059669;
}

.empty-records {
  text-align: center;
  padding: 40px 0;
  color: var(--text-muted);
}

.empty-records span {
  font-size: 36px;
}

.empty-records p {
  font-weight: 700;
  font-size: 14.5px;
  margin-top: 8px;
}

.ot-text {
  color: #2563eb;
  font-weight: 700;
}

.deduct-text {
  color: var(--danger);
  font-weight: 600;
}

.edit-row-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  padding: 6px;
  border-radius: var(--radius-sm);
  transition: var(--transition);
}

.edit-row-btn:hover:not(:disabled) {
  background: #f1f5f9;
  transform: scale(1.1);
}

.edit-row-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.target-teacher-tag {
  font-size: 14.5px;
  color: var(--text-main);
  background: #f8fafc;
  padding: 10px;
  border-radius: var(--radius-sm);
  border-left: 4px solid var(--accent);
}

/* Modal styling */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(6px);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.modal-container {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  background: white;
  padding: 32px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 20px;
  font-weight: 850;
  color: var(--primary-dark);
}

.close-modal-btn {
  background: transparent;
  border: none;
  font-size: 20px;
  color: var(--text-muted);
  cursor: pointer;
  transition: var(--transition);
}

.close-modal-btn:hover {
  color: var(--danger);
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
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
  font-weight: 500;
  outline: none;
  background: #f8fafc;
  transition: var(--transition);
}

.form-input:focus {
  border-color: var(--primary);
  background: white;
  box-shadow: 0 0 0 4px rgba(30, 58, 95, 0.08);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.animate-pop {
  animation: pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes pop {
  0% { transform: scale(0.9); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.spinner-container {
  display: flex;
  justify-content: center;
  padding: 30px 0;
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
/* Computation View Modal */
.computation-modal {
  max-height: 90vh;
  overflow-y: auto;
}

.comp-letterhead {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 24px;
}

.print-logo {
  width: 72px;
  height: 72px;
  object-fit: cover;
  flex-shrink: 0;
}

.letterhead-text {
  text-align: left;
}

.comp-school {
  font-size: 16.5px;
  font-weight: 900;
  color: var(--primary-dark);
  letter-spacing: 0.02em;
}

.comp-school-sub {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.comp-doc-title {
  font-size: 16px;
  font-weight: 900;
  color: var(--primary);
  margin-top: 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.comp-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
}

.comp-meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 13.5px;
}

.comp-label {
  font-weight: 600;
  color: var(--text-muted);
}

.comp-val {
  font-weight: 700;
  color: var(--text-main);
}

.comp-section-title {
  font-size: 14px;
  font-weight: 850;
  color: var(--primary-dark);
  margin: 12px 0 8px;
}

.comp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.comp-table th {
  background: #f1f5f9;
  padding: 8px 12px;
  text-align: left;
  font-weight: 800;
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border-bottom: 2px solid var(--divider);
}

.comp-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  font-weight: 600;
}

.comp-total-row td {
  background: #f8fafc;
  border-top: 2px solid var(--divider);
  font-size: 14px;
}

.comp-net-block {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 16px 20px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--primary-dark);
}

.comp-net-label {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--primary-dark);
}

.comp-net-amount {
  font-size: 22px;
  font-weight: 950;
  color: var(--primary-dark);
}

.comp-signatures {
  display: flex;
  justify-content: space-between;
  margin-top: 40px;
  padding: 0 20px;
}

.comp-sig {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
}

.comp-sig-line {
  width: 160px;
  border-bottom: 1.5px solid #94a3b8;
  margin-bottom: 4px;
}

/* Print Styles */
@media print {
  body * {
    visibility: hidden !important;
  }
  .computation-print-area,
  .computation-print-area * {
    visibility: visible !important;
  }
  .computation-print-area {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: white !important;
    z-index: 9999 !important;
    display: flex !important;
    align-items: flex-start !important;
    justify-content: center !important;
    padding: 20px !important;
  }
  .computation-modal {
    max-width: 100% !important;
    box-shadow: none !important;
    border: none !important;
  }
  .no-print {
    display: none !important;
  }
  .comp-net-block {
    background: #f8fafc !important;
    border: 2px solid #1e3a5f !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

.daily-hours-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.daily-hour-pill {
  font-size: 11.5px;
  font-weight: 700;
  padding: 6px 12px;
  background: #f1f5f9;
  color: var(--text-main);
  border-radius: var(--radius-sm);
  border: 1px solid var(--divider);
}
</style>
