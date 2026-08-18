<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import WebcamCapture from '@/components/WebcamCapture.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const columns = [
  { key: 'full_name', label: 'Teacher Name', sortable: true },
  { key: 'role', label: 'Designated Role', sortable: true },
  { key: 'hourly_rate', label: 'Hourly Rate', sortable: true },
  { key: 'actions', label: 'Actions', sortable: false, width: '280px' }
];

const teachers = ref<any[]>([]);
const loading = ref(false);

// Register/Edit Modal
const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref<number | null>(null);
const form = ref({
  last_name: '',
  first_name: '',
  middle_name: '',
  role: '',
  contact_no: '',
  face_encoding: '',
  hourly_rate: 0,
  deductions: [] as { deduction_type: string, deduction_name: string, amount: number }[]
});

const loadTeachers = async () => {
  loading.value = true;
  try {
    const res = await api.get('/teachers');
    if (res.success) {
      teachers.value = res.data.map((t: any) => ({
        ...t,
        full_name: `${t.last_name}, ${t.first_name} ${t.middle_name || ''}`.trim(),
        hourly_rate: t.hourly_rate ? `₱${Number(t.hourly_rate).toFixed(2)}/hr` : 'Not Set'
      }));
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Failed to load teachers list', 'error');
  } finally {
    loading.value = false;
  }
};

const openRegisterModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.value = {
    last_name: '',
    first_name: '',
    middle_name: '',
    role: '',
    contact_no: '',
    face_encoding: '',
    hourly_rate: 0,
    deductions: []
  };
  showModal.value = true;
};

const addDeduction = () => {
  form.value.deductions.push({
    deduction_type: 'SSS',
    deduction_name: '',
    amount: 0
  });
};

const removeDeduction = (index: number) => {
  form.value.deductions.splice(index, 1);
};

const openEditModal = (teacher: any) => {
  isEditing.value = true;
  editingId.value = teacher.teacher_id;
  form.value = {
    last_name: teacher.last_name,
    first_name: teacher.first_name,
    middle_name: teacher.middle_name || '',
    role: teacher.role,
    contact_no: teacher.contact_no || '',
    face_encoding: teacher.face_encoding || '',
    hourly_rate: teacher.hourly_rate ? parseFloat(String(teacher.hourly_rate).replace(/[^\d.]/g, '')) : 0,
    deductions: teacher.deductions ? teacher.deductions.map((d: any) => ({
      deduction_type: d.deduction_type,
      deduction_name: d.deduction_name || '',
      amount: parseFloat(d.amount)
    })) : []
  };
  showModal.value = true;
};

const handleTeacherSubmit = async () => {
  if (!form.value.face_encoding) {
    toastStore.showToast('Biometric face registration is required.', 'error');
    return;
  }
  
  try {
    let res;
    if (isEditing.value && editingId.value) {
      res = await api.put(`/teachers/${editingId.value}`, form.value);
    } else {
      res = await api.post('/teachers', form.value);
    }

    if (res.success) {
      toastStore.showToast(res.message || 'Teacher record saved!', 'success');
      showModal.value = false;
      loadTeachers();
    } else {
      toastStore.showToast(res.message || 'Failed to save teacher record', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error saving teacher details', 'error');
  }
};


const handleDelete = async (id: number) => {
  if (!confirm('Are you sure you want to delete this teacher? This will remove all their salary records and time records.')) return;
  try {
    const res = await api.delete(`/teachers/${id}`);
    if (res.success) {
      toastStore.showToast('Teacher record deleted!', 'success');
      loadTeachers();
    } else {
      toastStore.showToast(res.message || 'Failed to delete teacher record', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error deleting teacher record', 'error');
  }
};

onMounted(() => {
  loadTeachers();
});
</script>

<template>
  <div class="page-content">
    <Topbar title="Teachers" subtitle="Basic Education of Concepcion Holy Cross College, Inc." />

    <div class="controls-card card">
      <div class="header-row">
        <h2 class="section-title">Teacher Registry</h2>
        <button @click="openRegisterModal" class="btn btn-primary">
          ➕ Register Teacher
        </button>
      </div>
      <p class="section-tip">
        Manage teacher credentials, hourly billing rates, daily timecards (DTR), and biometric face templates.
      </p>
    </div>

    <!-- Data Table -->
    <div class="table-section" style="margin-top: 24px;">
      <DataTable
        :columns="columns"
        :data="teachers"
        :loading="loading"
        searchPlaceholder="Search by teacher name, role..."
      >
        <template #cell(actions)="{ item }">
          <div class="actions-wrapper">
            <router-link :to="`/teachers/${item.teacher_id}/dtr`" class="btn-action view-btn">
              📅 DTR
            </router-link>
            <button @click="openEditModal(item)" class="action-btn edit-btn" title="Edit Teacher">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button @click="handleDelete(item.teacher_id)" class="action-btn delete-btn" title="Delete Teacher">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Register / Edit Teacher Modal -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-container card animate-pop">
        <div class="modal-header">
          <h3>{{ isEditing ? 'Edit Teacher Profile' : 'Register New Teacher' }}</h3>
          <button @click="showModal = false" class="close-modal-btn">✕</button>
        </div>
        <div class="divider" style="margin: 16px 0;" />

        <form @submit.prevent="handleTeacherSubmit" class="modal-form">
          <div class="form-grid">
            <div class="form-fields">
              <div class="form-group">
                <label for="first_name" class="form-label">First Name</label>
                <input id="first_name" type="text" class="form-input" v-model="form.first_name" placeholder="First name" required />
              </div>

              <div class="form-group">
                <label for="last_name" class="form-label">Last Name</label>
                <input id="last_name" type="text" class="form-input" v-model="form.last_name" placeholder="Last name" required />
              </div>

              <div class="form-group">
                <label for="middle_name" class="form-label">Middle Name</label>
                <input id="middle_name" type="text" class="form-input" v-model="form.middle_name" placeholder="Middle name (optional)" />
              </div>

              <div class="form-group">
                <label for="role" class="form-label">Designated Role / Department</label>
                <select id="role" v-model="form.role" class="form-input" required>
                  <option value="">Select Department...</option>
                  <option value="Elementary Department">Elementary Department</option>
                  <option value="Junior High School Department">Junior High School Department</option>
                  <option value="Senior High School Department">Senior High School Department</option>
                </select>
              </div>

              <div class="form-group">
                <label for="contact_no" class="form-label">Contact Number</label>
                <input id="contact_no" type="text" class="form-input" v-model="form.contact_no" placeholder="e.g. +639..." />
              </div>
            </div>

            <!-- Salary & Deductions -->
            <div class="divider" style="margin: 16px 0;" />
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h4 style="color: var(--primary-dark); margin: 0;">Salary & Deductions</h4>
              <button type="button" @click="addDeduction" class="btn btn-secondary" style="padding: 6px 12px; font-size: 13px;">
                ➕ Add Salary Deduction
              </button>
            </div>
            
            <div class="form-grid" style="margin-bottom: 16px;">
              <div class="form-group">
                <label for="hourly_rate" class="form-label">Hourly Rate (₱)</label>
                <input id="hourly_rate" type="number" step="0.01" class="form-input" v-model="form.hourly_rate" />
              </div>
            </div>

            <!-- Dynamic Deductions List -->
            <div class="deductions-list" v-if="form.deductions.length > 0">
              <div v-for="(deduction, index) in form.deductions" :key="index" class="deduction-row">
                <div class="form-group" style="flex: 1;">
                  <label class="form-label">Deduction Type</label>
                  <select v-model="deduction.deduction_type" class="form-input" required>
                    <option value="SSS">SSS</option>
                    <option value="PhilHealth">PhilHealth</option>
                    <option value="Pag-IBIG">Pag-IBIG</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                
                <div class="form-group" style="flex: 1;" v-if="deduction.deduction_type === 'Others'">
                  <label class="form-label">Deduction Name</label>
                  <input type="text" class="form-input" v-model="deduction.deduction_name" placeholder="e.g. Loan" required />
                </div>

                <div class="form-group" style="flex: 1;">
                  <label class="form-label">Amount (₱)</label>
                  <input type="number" step="0.01" class="form-input" v-model="deduction.amount" required />
                </div>

                <button type="button" @click="removeDeduction(index)" class="remove-btn" title="Remove Deduction">
                  🗑️
                </button>
              </div>
            </div>
            <div v-else class="empty-deductions">
              No deductions added. Click "Add Salary Deduction" to add one.
            </div>

            <!-- Face Registration Webcam Capture -->
            <div class="webcam-column">
              <label class="form-label">Biometric Face Capture (Required) <span style="color: red;">*</span></label>
              <div class="webcam-frame">
                <WebcamCapture v-model="form.face_encoding" />
              </div>
            </div>
          </div>

          <div class="divider" style="margin: 24px 0 16px 0;" />
          <div class="form-actions">
            <button type="button" @click="showModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">
              {{ isEditing ? 'Save Details' : 'Confirm Registration' }}
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
  background: white;
  color: var(--text-main);
  border: 1.5px solid var(--divider);
}

.btn-secondary:hover {
  background: #f1f5f9;
  border-color: var(--primary-light);
}

.deductions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.deduction-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  background: #f8fafc;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--divider);
}

.empty-deductions {
  font-size: 13.5px;
  color: var(--text-muted);
  font-style: italic;
  padding: 16px;
  text-align: center;
  background: #f8fafc;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--divider);
}

.remove-btn {
  background: #fee2e2;
  color: #ef4444;
  border: none;
  border-radius: var(--radius-sm);
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  transition: var(--transition);
}

.remove-btn:hover {
  background: #fecaca;
  transform: scale(1.05);
}

.actions-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.btn-action {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  border: 1px solid var(--divider);
  cursor: pointer;
  text-decoration: none;
  transition: var(--transition);
  display: inline-flex;
  align-items: center;
  background: white;
}

.view-btn {
  color: var(--primary);
  border-color: rgba(30, 58, 95, 0.15);
}

.view-btn:hover {
  background: var(--secondary);
  border-color: var(--primary);
  transform: translateY(-1px);
}

.rate-btn {
  color: #d97706;
  border-color: rgba(245, 158, 11, 0.15);
}

.rate-btn:hover {
  background: rgba(245, 158, 11, 0.05);
  border-color: #d97706;
  transform: translateY(-1px);
}

.action-btn {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--divider);
  background: white;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition);
}

.action-btn:hover {
  background: #f8fafc;
  color: var(--text-main);
  border-color: #cbd5e1;
  transform: translateY(-1px);
}

.edit-btn:hover {
  color: var(--primary);
  border-color: var(--primary);
  background: #f0fdf4;
}

.delete-btn:hover {
  color: #ef4444;
  border-color: #fca5a5;
  background: #fef2f2;
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
