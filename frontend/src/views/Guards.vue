<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import WebcamCapture from '@/components/WebcamCapture.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const columns = [
  { key: 'guard_no', label: 'Staff No', sortable: true },
  { key: 'full_name', label: 'Full Name', sortable: true },
  { key: 'face_registered', label: 'Biometrics status', sortable: false },
  { key: 'actions', label: 'Actions', sortable: false, width: '150px' }
];

const guards = ref<any[]>([]);
const loading = ref(false);

const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref<number | null>(null);

const form = ref({
  guard_no: '',
  full_name: '',
  face_encoding: ''
});

const loadGuards = async () => {
  loading.value = true;
  try {
    const res = await api.get('/guards');
    if (res.success) {
      guards.value = res.data.map((g: any) => ({
        ...g,
        face_registered: g.face_encoding ? '✅ Registered' : '❌ Unregistered'
      }));
    } else {
      toastStore.showToast(res.message || 'Failed to load guards', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Network error loading guards', 'error');
  } finally {
    loading.value = false;
  }
};

const openRegisterModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.value = {
    guard_no: '',
    full_name: '',
    face_encoding: ''
  };
  showModal.value = true;
};

const openEditModal = (guard: any) => {
  isEditing.value = true;
  editingId.value = guard.guard_id;
  form.value = {
    guard_no: guard.guard_no,
    full_name: guard.full_name,
    face_encoding: guard.face_encoding || ''
  };
  showModal.value = true;
};

const handleSubmit = async () => {
  try {
    let res;
    if (isEditing.value && editingId.value) {
      res = await api.put(`/guards/${editingId.value}`, form.value);
    } else {
      res = await api.post('/guards', form.value);
    }

    if (res.success) {
      toastStore.showToast(res.message || 'Staff details saved!', 'success');
      showModal.value = false;
      loadGuards();
    } else {
      toastStore.showToast(res.message || 'Failed to save staff details', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Server error saving staff details', 'error');
  }
};

const handleDelete = async (id: number) => {
  if (!confirm('Are you sure you want to delete this staff record?')) return;

  try {
    const res = await api.delete(`/guards/${id}`);
    if (res.success) {
      toastStore.showToast('Staff record deleted!', 'success');
      loadGuards();
    } else {
      toastStore.showToast(res.message || 'Failed to delete staff record', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Server error deleting staff record', 'error');
  }
};

onMounted(() => {
  loadGuards();
});
</script>

<template>
  <div class="page-content">
    <Topbar title="Staff & Guards" subtitle="Basic Education of Concepcion Holy Cross College, Inc." />

    <div class="controls-card card">
      <div class="header-row">
        <h2 class="section-title">Security & System Staff Directory</h2>
        <button @click="openRegisterModal" class="btn btn-primary">
          ➕ Register Staff / Guard
        </button>
      </div>
      <p class="section-tip">
        Staff and guards registered here can authenticate attendance scans and manage biometric school gate control terminals.
      </p>
    </div>

    <!-- Data Table -->
    <div class="table-section" style="margin-top: 24px;">
      <DataTable
        :columns="columns"
        :data="guards"
        :loading="loading"
        searchPlaceholder="Search by staff number, full name..."
      >
        <template #cell(face_registered)="{ value, item }">
          <span :style="{ color: item.face_encoding ? '#10b981' : '#ef4444', fontWeight: '800' }">
            {{ value }}
          </span>
        </template>
        <template #cell(actions)="{ item }">
          <div class="actions-wrapper">
            <button @click="openEditModal(item)" class="action-btn edit-btn" title="Edit Staff">
              ✏️
            </button>
            <button @click="handleDelete(item.guard_id)" class="action-btn delete-btn" title="Delete Staff">
              🗑️
            </button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Registration / Editing Modal -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-container card animate-pop">
        <div class="modal-header">
          <h3>{{ isEditing ? 'Edit Staff Details' : 'Register New Staff / Guard' }}</h3>
          <button @click="showModal = false" class="close-modal-btn">✕</button>
        </div>
        <div class="divider" style="margin: 16px 0;" />

        <form @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-grid">
            <div class="form-fields">
              <div class="form-group">
                <label for="guard_no" class="form-label">Staff / Guard ID Number</label>
                <input
                  id="guard_no"
                  type="text"
                  class="form-input"
                  v-model="form.guard_no"
                  placeholder="e.g. GUARD-01"
                  required
                  :disabled="isEditing"
                />
              </div>

              <div class="form-group" style="margin-top: 8px;">
                <label for="full_name" class="form-label">Full Name</label>
                <input
                  id="full_name"
                  type="text"
                  class="form-input"
                  v-model="form.full_name"
                  placeholder="Full name"
                  required
                />
              </div>
            </div>

            <!-- Face Registration Webcam Capture -->
            <div class="webcam-column">
              <label class="form-label">Staff Biometrics Capture (Optional)</label>
              <div class="webcam-frame">
                <WebcamCapture v-model="form.face_encoding" />
              </div>
            </div>
          </div>

          <div class="divider" style="margin: 24px 0 16px 0;" />
          <div class="form-actions">
            <button type="button" @click="showModal = false" class="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              {{ isEditing ? 'Save Changes' : 'Confirm Registration' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.controls-card {
  padding: 24px;
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

.action-btn {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--divider);
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
  font-size: 14px;
}

.action-btn:hover {
  transform: scale(1.05);
}

.edit-btn:hover {
  background: #eff6ff;
  border-color: var(--primary-light);
}

.delete-btn:hover {
  background: #fef2f2;
  border-color: var(--danger);
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
  max-width: 800px;
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

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  align-items: start;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
}

.form-fields {
  display: flex;
  flex-direction: column;
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

.webcam-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.webcam-frame {
  width: 100%;
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
</style>
