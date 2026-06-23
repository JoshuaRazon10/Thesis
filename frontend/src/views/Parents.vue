<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const columns = [
  { key: 'guardian_name', label: 'Guardian Name', sortable: true },
  { key: 'contact_no', label: 'Contact No', sortable: false },
  { key: 'student_name', label: 'Linked Student', sortable: true },
  { key: 'actions', label: 'Actions', sortable: false, width: '150px' }
];

const parents = ref<any[]>([]);
const students = ref<any[]>([]);
const loading = ref(false);

const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref<number | null>(null);

const form = ref({
  student_id: '',
  guardian_name: '',
  contact_no: ''
});

const loadData = async () => {
  loading.value = true;
  try {
    const parentRes = await api.get('/parents');
    if (parentRes.success) {
      parents.value = parentRes.data.map((p: any) => ({
        ...p,
        student_name: p.student_first_name && p.student_last_name 
          ? `${p.student_last_name}, ${p.student_first_name} (${p.grade_level || ''} - ${p.section || ''})` 
          : 'None linked'
      }));
    }

    const studentRes = await api.get('/students');
    if (studentRes.success) {
      students.value = studentRes.data;
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error loading directory data', 'error');
  } finally {
    loading.value = false;
  }
};

const openRegisterModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.value = {
    student_id: '',
    guardian_name: '',
    contact_no: ''
  };
  showModal.value = true;
};

const openEditModal = (parent: any) => {
  isEditing.value = true;
  editingId.value = parent.parent_id;
  form.value = {
    student_id: String(parent.student_id),
    guardian_name: parent.guardian_name,
    contact_no: parent.contact_no
  };
  showModal.value = true;
};

const handleSubmit = async () => {
  try {
    let res;
    if (isEditing.value && editingId.value) {
      res = await api.put(`/parents/${editingId.value}`, form.value);
    } else {
      res = await api.post('/parents', form.value);
    }

    if (res.success) {
      toastStore.showToast(res.message || 'Guardian record saved!', 'success');
      showModal.value = false;
      loadData();
    } else {
      toastStore.showToast(res.message || 'Failed to save guardian record', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Server error saving guardian record', 'error');
  }
};

const handleDelete = async (id: number) => {
  if (!confirm('Are you sure you want to delete this guardian record?')) return;

  try {
    const res = await api.delete(`/parents/${id}`);
    if (res.success) {
      toastStore.showToast('Guardian record deleted!', 'success');
      loadData();
    } else {
      toastStore.showToast(res.message || 'Failed to delete guardian record', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Server error deleting guardian record', 'error');
  }
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="page-content">
    <Topbar title="Parents & Guardians" subtitle="Basic Education of Concepcion Holy Cross College, Inc." />

    <div class="controls-card card">
      <div class="header-row">
        <h2 class="section-title">Guardian Directory</h2>
        <button @click="openRegisterModal" class="btn btn-primary">
          ➕ Register Guardian
        </button>
      </div>
      <p class="section-tip">
        Register parent contacts here to enable automatic real-time SMS status updates when students pass through scan gates.
      </p>
    </div>

    <!-- Data Table -->
    <div class="table-section" style="margin-top: 24px;">
      <DataTable
        :columns="columns"
        :data="parents"
        :loading="loading"
        searchPlaceholder="Search by guardian name, phone, student..."
      >
        <template #cell(actions)="{ item }">
          <div class="actions-wrapper">
            <button @click="openEditModal(item)" class="action-btn edit-btn" title="Edit Guardian">
              ✏️
            </button>
            <button @click="handleDelete(item.parent_id)" class="action-btn delete-btn" title="Delete Guardian">
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
          <h3>{{ isEditing ? 'Edit Guardian Details' : 'Register New Guardian' }}</h3>
          <button @click="showModal = false" class="close-modal-btn">✕</button>
        </div>
        <div class="divider" style="margin: 16px 0;" />

        <form @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-fields">
            <div class="form-group">
              <label for="guardian_name" class="form-label">Full Name of Guardian</label>
              <input
                id="guardian_name"
                type="text"
                class="form-input"
                v-model="form.guardian_name"
                placeholder="e.g. Maria Clara Santos"
                required
              />
            </div>

            <div class="form-group">
              <label for="contact_no" class="form-label">Mobile Contact Number (SMS Output)</label>
              <input
                id="contact_no"
                type="text"
                class="form-input"
                v-model="form.contact_no"
                placeholder="e.g. +639123456789"
                required
              />
            </div>

            <div class="form-group">
              <label for="student_id" class="form-label">Link Student Profile</label>
              <select id="student_id" v-model="form.student_id" class="form-input" required>
                <option value="">Select student to link...</option>
                <option v-for="s in students" :key="s.student_id" :value="s.student_id">
                  {{ s.last_name }}, {{ s.first_name }} ({{ s.student_no }}) - {{ s.grade_level }} {{ s.section }}
                </option>
              </select>
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
</style>
