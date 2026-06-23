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
  face_encoding: ''
});

// Set Salary Rate Modal
const showRateModal = ref(false);
const rateTeacherId = ref<number | null>(null);
const rateTeacherName = ref('');
const rateForm = ref({
  hourly_rate: 0,
  effective_date: new Date().toISOString().slice(0, 10)
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
    face_encoding: ''
  };
  showModal.value = true;
};

const openEditModal = (teacher: any) => {
  isEditing.value = true;
  editingId.value = teacher.teacher_id;
  form.value = {
    last_name: teacher.last_name,
    first_name: teacher.first_name,
    middle_name: teacher.middle_name || '',
    role: teacher.role,
    face_encoding: teacher.face_encoding || ''
  };
  showModal.value = true;
};

const openRateModal = (teacher: any) => {
  rateTeacherId.value = teacher.teacher_id;
  rateTeacherName.value = teacher.full_name;
  
  // Extract number from ₱XX.XX/hr string
  const currentRateVal = teacher.hourly_rate !== 'Not Set' 
    ? parseFloat(teacher.hourly_rate.replace(/[^\d.]/g, '')) 
    : 0;

  rateForm.value = {
    hourly_rate: currentRateVal,
    effective_date: new Date().toISOString().slice(0, 10)
  };
  showRateModal.value = true;
};

const handleTeacherSubmit = async () => {
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

const handleRateSubmit = async () => {
  if (!rateTeacherId.value) return;
  try {
    const res = await api.post(`/teachers/${rateTeacherId.value}/salary`, rateForm.value);
    if (res.success) {
      toastStore.showToast('Salary rate updated successfully!', 'success');
      showRateModal.value = false;
      loadTeachers();
    } else {
      toastStore.showToast(res.message || 'Failed to set salary rate', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Error updating salary rate', 'error');
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
            <button @click="openRateModal(item)" class="btn-action rate-btn">
              ₱ Rate
            </button>
            <button @click="openEditModal(item)" class="action-btn edit-btn" title="Edit Teacher">
              ✏️
            </button>
            <button @click="handleDelete(item.teacher_id)" class="action-btn delete-btn" title="Delete Teacher">
              🗑️
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
            </div>

            <!-- Face Registration Webcam Capture -->
            <div class="webcam-column">
              <label class="form-label">Biometric Face Capture (Optional)</label>
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

    <!-- Salary Rate Modal -->
    <div v-if="showRateModal" class="modal-overlay">
      <div class="modal-container card animate-pop" style="max-width: 450px;">
        <div class="modal-header">
          <h3>Set Hourly Salary Rate</h3>
          <button @click="showRateModal = false" class="close-modal-btn">✕</button>
        </div>
        <div class="divider" style="margin: 16px 0;" />
        <p class="target-teacher-tag">Teacher: <strong>{{ rateTeacherName }}</strong></p>

        <form @submit.prevent="handleRateSubmit" class="modal-form" style="margin-top: 16px;">
          <div class="form-fields">
            <div class="form-group">
              <label for="hourly_rate" class="form-label">Hourly Pay Rate (PHP ₱)</label>
              <input
                id="hourly_rate"
                type="number"
                step="0.01"
                class="form-input"
                v-model="rateForm.hourly_rate"
                placeholder="0.00"
                required
              />
            </div>

            <div class="form-group">
              <label for="effective_date" class="form-label">Effective Date</label>
              <input id="effective_date" type="date" class="form-input" v-model="rateForm.effective_date" required />
            </div>
          </div>

          <div class="divider" style="margin: 24px 0 16px 0;" />
          <div class="form-actions">
            <button type="button" @click="showRateModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Pay Rate</button>
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
