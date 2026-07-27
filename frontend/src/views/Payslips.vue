<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const columns = [
  { key: 'teacher_name', label: 'Teacher Name', sortable: true },
  { key: 'period_name', label: 'Payroll Period', sortable: true },
  { key: 'net_pay', label: 'Net Pay', sortable: true },
  { key: 'generated_at', label: 'Generated Date', sortable: true },
  { key: 'actions', label: 'Actions', sortable: false, width: '150px' }
];

const payslips = ref<any[]>([]);
const periods = ref<any[]>([]);
const loading = ref(false);

// Filters
const filterPeriod = ref('');

// Print Modal
const showPrintModal = ref(false);
const activePayslip = ref<any>(null);

const loadData = async () => {
  loading.value = true;
  try {
    const payslipRes = await api.get('/payslips');
    if (payslipRes.success) {
      payslips.value = payslipRes.data.map((p: any) => ({
        ...p,
        teacher_name: `${p.last_name}, ${p.first_name}`,
        parsed_data: typeof p.payslip_data === 'string' ? JSON.parse(p.payslip_data) : (p.payslip_data || {})
      }));
    }

    const periodsRes = await api.get('/payroll/periods');
    if (periodsRes.success) {
      periods.value = periodsRes.data.filter((p: any) => p.status === 'finalized');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error loading payslips', 'error');
  } finally {
    loading.value = false;
  }
};

const handlePrint = (payslip: any) => {
  activePayslip.value = payslip;
  showPrintModal.value = true;
  // Trigger window print after modal render
  setTimeout(() => {
    window.print();
  }, 300);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
};

const formatDailyDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const filteredPayslips = computed(() => {
  return payslips.value.filter((p) => {
    return !filterPeriod.value || p.period_id === Number(filterPeriod.value);
  });
});

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="page-content">
    <!-- Screen Header (Hidden on Print) -->
    <Topbar title="Payslips" subtitle="Basic Education of Concepcion Holy Cross College, Inc." class="no-print" />

    <!-- Filters Area (Hidden on Print) -->
    <div class="controls-card card no-print" style="margin-top: 32px;">
      <div class="filters-row">
        <div class="filter-group">
          <label>Filter by Finalized Period</label>
          <select v-model="filterPeriod" class="filter-select">
            <option value="">All Finalized Periods</option>
            <option v-for="p in periods" :key="p.period_id" :value="p.period_id">
              {{ p.period_name }} ({{ formatDate(p.start_date) }} - {{ formatDate(p.end_date) }})
            </option>
          </select>
        </div>
      </div>
    </div>

    <!-- Payslip Table (Hidden on Print) -->
    <div class="table-section no-print" style="margin-top: 24px;">
      <DataTable
        :columns="columns"
        :data="filteredPayslips"
        :loading="loading"
        searchPlaceholder="Search by teacher name..."
      >
        <template #cell(net_pay)="{ value }">
          <strong>₱{{ Number(value).toFixed(2) }}</strong>
        </template>
        <template #cell(generated_at)="{ value }">
          {{ formatDate(value) }}
        </template>
        <template #cell(actions)="{ item }">
          <button @click="handlePrint(item)" class="btn-print-action">
            🖨️ Print Payslip
          </button>
        </template>
      </DataTable>
    </div>

    <!-- PRINT VIEW MODAL FRAME (Styled for Window.print letterhead size) -->
    <div v-if="showPrintModal" class="print-overlay" :class="{ 'print-only-show': showPrintModal }">
      <div class="print-container card">
        <button @click="showPrintModal = false" class="close-print-btn no-print">✕ Close Print view</button>
        
        <div class="payslip-box" v-if="activePayslip">
          <!-- Letterhead -->
          <div class="school-letterhead">
            <img src="/images/chcc_circle.png" alt="CHCC Logo" class="print-logo" />
            <div class="letterhead-text">
              <div class="school-title">BASIC EDUCATION OF CONCEPCION HOLY CROSS COLLEGE, INC.</div>
              <div class="school-sub">Concepcion, Tarlac, Philippines</div>
              <div class="system-tag">Teacher Salary Statement / Payslip</div>
            </div>
          </div>
          <div class="divider" />

          <!-- Metadata -->
          <div class="meta-grid">
            <div class="meta-row">
              <span class="label">Teacher Name:</span>
              <span class="val"><strong>{{ activePayslip.teacher_name }}</strong></span>
            </div>
            <div class="meta-row">
              <span class="label">Payroll Period:</span>
              <span class="val">{{ activePayslip.period_name }} ({{ formatDate(activePayslip.start_date) }} - {{ formatDate(activePayslip.end_date) }})</span>
            </div>
            <div class="meta-row">
              <span class="label">Department:</span>
              <span class="val">Basic Education Department</span>
            </div>
            <div class="meta-row">
              <span class="label">Issued Date:</span>
              <span class="val">{{ formatDate(activePayslip.generated_at) }}</span>
            </div>
          </div>

          <div class="divider" />

          <!-- Daily Hours Breakdown -->
          <div v-if="activePayslip.parsed_data?.summary?.daily_logs?.length > 0">
            <h4 class="col-title" style="border-bottom: none; margin-bottom: 4px;">📅 Daily Hours Breakdown</h4>
            <div class="daily-hours-list">
              <span class="daily-hour-pill" v-for="log in activePayslip.parsed_data.summary.daily_logs" :key="log.log_date">
                {{ formatDailyDate(log.log_date) }} ({{ Number(log.hours_worked).toFixed(1) }} hrs)
              </span>
            </div>
            <div class="divider" />
          </div>

          <!-- Breakdown -->
          <div class="breakdown-columns">
            <!-- Earnings -->
            <div class="column-section">
              <h4 class="col-title">Earnings Breakdown</h4>
              <div class="item-line">
                <span>Regular Hours Work:</span>
                <span>{{ Number(activePayslip.parsed_data?.earnings?.regular_hours || 0).toFixed(1) }} hrs</span>
              </div>
              <div class="item-line">
                <span>Overtime Hours Work:</span>
                <span>{{ Number(activePayslip.parsed_data?.earnings?.overtime_hours || 0).toFixed(1) }} hrs (1.25x)</span>
              </div>
              <div class="item-line total-item">
                <span>Gross Earnings:</span>
                <span>₱{{ Number(activePayslip.gross_pay).toFixed(2) }}</span>
              </div>
            </div>

            <!-- Deductions -->
            <div class="column-section">
              <h4 class="col-title text-danger">Deductions</h4>
              
              <div class="item-line" v-for="(ded, i) in (activePayslip.parsed_data?.deductions?.details || [])" :key="i">
                <span>{{ ded.name }}:</span>
                <span class="text-danger">-₱{{ Number(ded.amount).toFixed(2) }}</span>
              </div>
              
              <div class="item-line" v-if="!activePayslip.parsed_data?.deductions?.details?.length">
                <span>None</span>
                <span class="text-danger">₱0.00</span>
              </div>

              <div class="item-line total-item">
                <span>Total Deductions:</span>
                <span class="text-danger">₱{{ Number(activePayslip.parsed_data?.deductions?.total_deductions || 0).toFixed(2) }}</span>
              </div>
            </div>
          </div>

          <div class="divider" />

          <!-- Net Salary -->
          <div class="net-salary-block">
            <span class="net-title">Total Net Salary (Take-home Pay)</span>
            <span class="net-amount">₱{{ Number(activePayslip.net_pay).toFixed(2) }}</span>
          </div>

          <!-- Signatures -->
          <div class="signatures-row">
            <div class="sig-line">
              <div class="line"></div>
              <span>Faculty Signature</span>
            </div>
            <div class="sig-line">
              <div class="line"></div>
              <span>Authorized Signatory</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.controls-card {
  padding: 24px;
}

.filters-row {
  display: flex;
  gap: 20px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: 400px;
}

.filter-group label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.filter-select {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--divider);
  font-family: inherit;
  font-weight: 600;
  background: white;
  outline: none;
}

.btn-print-action {
  background: transparent;
  border: 1.5px solid var(--divider);
  padding: 6px 14px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  color: var(--primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition);
}

.btn-print-action:hover {
  background: var(--secondary);
  border-color: var(--primary);
}

/* Print View Overlay (Normal modal behavior on screen, clean pages on print) */
.print-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(6px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.print-container {
  width: 100%;
  max-width: 700px;
  background: white;
  padding: 40px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
  position: relative;
}

.close-print-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  background: var(--danger);
  color: white;
  border: none;
  font-family: inherit;
  font-weight: 700;
  font-size: 12px;
  padding: 8px 16px;
  border-radius: 9999px;
  cursor: pointer;
  transition: var(--transition);
}

.close-print-btn:hover {
  transform: translateY(-1px);
  background: #dc2626;
}

.payslip-box {
  width: 100%;
}

.school-letterhead {
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

.school-title {
  font-size: 16.5px;
  font-weight: 900;
  color: var(--primary-dark);
  letter-spacing: 0.02em;
}

.school-sub {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 2px;
}

.system-tag {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-top: 6px;
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  font-size: 13.5px;
}

.meta-row {
  display: flex;
  gap: 8px;
}

.meta-row .label {
  font-weight: 700;
  color: var(--text-muted);
  width: 110px;
}

.meta-row .val {
  color: var(--text-main);
  font-weight: 600;
}

.breakdown-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}

@media (max-width: 600px) {
  .breakdown-columns {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

.column-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.col-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--primary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 1.5px solid var(--divider);
  padding-bottom: 4px;
}

.item-line {
  display: flex;
  justify-content: space-between;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-main);
}

.total-item {
  border-top: 1px dashed var(--divider);
  padding-top: 8px;
  font-weight: 800;
}

.net-salary-block {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 16px 20px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--primary-dark);
}

.net-title {
  font-size: 14.5px;
  font-weight: 800;
  color: var(--primary-dark);
}

.net-amount {
  font-size: 22px;
  font-weight: 950;
  color: var(--primary-dark);
}

.signatures-row {
  display: flex;
  justify-content: space-between;
  margin-top: 40px;
  padding: 0 20px;
}

.sig-line {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 180px;
}

.sig-line .line {
  width: 100%;
  height: 1px;
  background: black;
}

.sig-line span {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
}

/* Print Specific Rules */
.print-only-show {
  display: none;
}

@media print {
  .no-print {
    display: none !important;
  }
  .print-only-show {
    display: block !important;
    position: absolute !important;
    top: 0 !important; left: 0 !important;
    width: 100% !important; height: auto !important;
    background: white !important;
    backdrop-filter: none !important;
    z-index: 9999 !important;
    padding: 0 !important;
  }
  .print-container {
    box-shadow: none !important;
    padding: 0 !important;
    border: none !important;
    max-width: 100% !important;
  }
  .close-print-btn {
    display: none !important;
  }
  .net-salary-block {
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
