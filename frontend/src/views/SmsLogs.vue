<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const columns = [
  { key: 'created_at', label: 'Timestamp', sortable: true },
  { key: 'guardian_name', label: 'Guardian Recipient', sortable: true },
  { key: 'contact_no', label: 'Mobile Number', sortable: false },
  { key: 'message', label: 'Message Details', sortable: false },
  { key: 'status', label: 'Transmission Status', sortable: true }
];

const smsLogs = ref<any[]>([]);
const loading = ref(false);

const loadSmsLogs = async () => {
  loading.value = true;
  try {
    const res = await api.get('/sms');
    if (res.success) {
      smsLogs.value = res.data;
    } else {
      toastStore.showToast(res.message || 'Failed to fetch SMS logs', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Network error loading SMS outbox', 'error');
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

onMounted(() => {
  loadSmsLogs();
});
</script>

<template>
  <div class="page-content">
    <Topbar title="SMS Logs" subtitle="Parent notification dispatch logs" />

    <div class="controls-card card">
      <div class="header-row">
        <h2 class="section-title">SMS Outbox Queue</h2>
        <button @click="loadSmsLogs" class="btn btn-secondary">
          🔄 Refresh Logs
        </button>
      </div>
      <p class="section-tip">
        Review real-time cellular transmissions triggered by scan gates. All SMS messages are dispatched via httpSMS API.
      </p>
    </div>

    <!-- Data Table -->
    <div class="table-section" style="margin-top: 24px;">
      <DataTable
        :columns="columns"
        :data="smsLogs"
        :loading="loading"
        searchPlaceholder="Search by parent name, mobile number, content..."
      >
        <template #cell(created_at)="{ value }">
          {{ formatDate(value) }}
        </template>
        <template #cell(status)="{ value }">
          <span class="badge" :class="value.toLowerCase()">{{ value }}</span>
        </template>
      </DataTable>
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
  padding: 10px 20px;
  border-radius: 9999px;
  font-family: inherit;
  font-weight: 700;
  font-size: 13.5px;
  border: none;
  cursor: pointer;
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

.badge {
  font-size: 11px;
  font-weight: 900;
  padding: 4px 10px;
  border-radius: 9999px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: inline-block;
}

.badge.sent {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.badge.pending {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.badge.retrying {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}

.badge.failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
</style>
