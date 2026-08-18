<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import WebcamCapture from '@/components/WebcamCapture.vue';
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

// Searchable student dropdown
const studentSearch = ref('');
const showStudentDropdown = ref(false);

const filteredStudents = computed(() => {
  const q = studentSearch.value.toLowerCase().trim();
  if (!q) return students.value;
  return students.value.filter((s: any) => {
    const full = `${s.student_no} ${s.last_name} ${s.first_name} ${s.grade_level || ''} ${s.section || ''}`.toLowerCase();
    return full.includes(q);
  });
});

const selectedStudentLabel = computed(() => {
  if (!form.value.student_id) return '';
  const s = students.value.find((st: any) => String(st.student_id) === String(form.value.student_id));
  if (!s) return '';
  return `${s.last_name}, ${s.first_name} (${s.student_no}) - ${s.grade_level || ''} ${s.section || ''}`;
});

function selectStudent(s: any) {
  form.value.student_id = String(s.student_id);
  studentSearch.value = `${s.last_name}, ${s.first_name} (${s.student_no})`;
  showStudentDropdown.value = false;
}

function onStudentSearchFocus() {
  showStudentDropdown.value = true;
}

function onStudentSearchBlur() {
  // Delay to allow click on dropdown item
  setTimeout(() => { showStudentDropdown.value = false; }, 200);
}

const form = ref({
  student_id: '',
  guardian_name: '',
  contact_no: '',
  face_encoding: '',
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
    contact_no: '',
    face_encoding: '',
  };
  studentSearch.value = '';
  showModal.value = true;
};

const openEditModal = (parent: any) => {
  isEditing.value = true;
  editingId.value = parent.parent_id;
  form.value = {
    student_id: String(parent.student_id),
    guardian_name: parent.guardian_name,
    contact_no: parent.contact_no,
    face_encoding: parent.face_encoding || '',
  };
  // Pre-fill search with current linked student
  const s = students.value.find((st: any) => String(st.student_id) === String(parent.student_id));
  studentSearch.value = s ? `${s.last_name}, ${s.first_name} (${s.student_no})` : '';
  showModal.value = true;
};

const handleSubmit = async () => {
  if (!isEditing.value && !form.value.face_encoding) {
    toastStore.showToast('Biometric face registration is required for parents staying at school.', 'error');
    return;
  }
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
    <Topbar title="Parents (Staying at School)" subtitle="Basic Education of Concepcion Holy Cross College, Inc." />

    <div class="controls-card card">
      <div class="header-row">
        <h2 class="section-title">Residing Parents / Guardians</h2>
        <button @click="openRegisterModal" class="btn btn-primary">
          ➕ Register Staying Parent
        </button>
      </div>
      <p class="section-tip">
        Register parents/guardians who stay at the school here to capture their biometrics for gate access.
        <br />
        <span style="color: #f5a623; font-weight: 700;">Note:</span> Standard parent contact details for SMS alerts are registered directly within the Student Registration form.
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button @click="handleDelete(item.parent_id)" class="action-btn delete-btn" title="Delete Guardian">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </template>
      </DataTable>
    </div>

    <!-- Registration / Editing Modal -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-container card animate-pop">
        <div class="modal-header">
          <h3>{{ isEditing ? 'Edit Staying Parent Details' : 'Register New Staying Parent' }}</h3>
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
              <div class="student-search-wrapper">
                <input
                  id="student_id"
                  type="text"
                  class="form-input"
                  v-model="studentSearch"
                  placeholder="Search by Student ID, name, grade..."
                  @focus="onStudentSearchFocus"
                  @blur="onStudentSearchBlur"
                  autocomplete="off"
                />
                <div v-if="showStudentDropdown" class="student-dropdown">
                  <div v-if="filteredStudents.length === 0" class="student-dropdown-empty">
                    No students found
                  </div>
                  <div
                    v-for="s in filteredStudents"
                    :key="s.student_id"
                    class="student-dropdown-item"
                    :class="{ active: String(s.student_id) === String(form.student_id) }"
                    @mousedown.prevent="selectStudent(s)"
                  >
                    <span class="student-id-badge">{{ s.student_no }}</span>
                    <span class="student-dropdown-name">{{ s.last_name }}, {{ s.first_name }}</span>
                    <span class="student-dropdown-meta">{{ s.grade_level || '' }} {{ s.section || '' }}</span>
                  </div>
                </div>
                <div v-if="form.student_id && !showStudentDropdown" class="selected-student-tag">
                  ✅ {{ selectedStudentLabel }}
                </div>
              </div>
            </div>
            
            <!-- Face Registration Webcam Capture -->
            <div class="webcam-column">
              <label class="form-label">🔍 Biometric Face Registration (Required for staying parents)</label>
              <div class="webcam-frame">
                <WebcamCapture
                  v-model="form.face_encoding"
                />
              </div>
              <p class="webcam-tip">
                <strong>Step 1:</strong> Center face in oval → <strong>Step 2:</strong> Blink eyes → Auto capture & save biometric data.
              </p>
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

/* Searchable student dropdown */
.student-search-wrapper {
  position: relative;
}

.student-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 200px;
  overflow-y: auto;
  background: white;
  border: 1.5px solid var(--primary);
  border-top: none;
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 10;
}

.student-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 500;
  transition: background 0.15s;
}

.student-dropdown-item:hover,
.student-dropdown-item.active {
  background: #eef2ff;
}

.student-dropdown-item.active {
  font-weight: 700;
}

.student-id-badge {
  background: var(--primary);
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
}

.student-dropdown-name {
  flex: 1;
  color: var(--text-main);
  font-weight: 600;
}

.student-dropdown-meta {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.student-dropdown-empty {
  padding: 14px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
}

.selected-student-tag {
  margin-top: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #15803d;
  background: #dcfce7;
  padding: 6px 12px;
  border-radius: 8px;
}
</style>
