<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import Topbar from '@/components/Topbar.vue';
import DataTable from '@/components/DataTable.vue';
import WebcamCapture from '@/components/WebcamCapture.vue';
import { api } from '@/lib/api';
import { useToastStore } from '@/stores/toast';

const toastStore = useToastStore();

const columns = [
  { key: 'student_no', label: 'Student No', sortable: true },
  { key: 'last_name', label: 'Last Name', sortable: true },
  { key: 'first_name', label: 'First Name', sortable: true },
  { key: 'grade_level', label: 'Grade Level', sortable: true },
  { key: 'section', label: 'Section', sortable: true },
  { key: 'actions', label: 'Actions', sortable: false, width: '150px' }
];

const students = ref<any[]>([]);
const loading = ref(false);

// Filter values
const selectedGrade = ref('');
const selectedSection = ref('');

// Modals
const showModal = ref(false);
const isEditing = ref(false);
const editingId = ref<number | null>(null);

// Form
const form = ref({
  student_no: '',
  last_name: '',
  first_name: '',
  middle_name: '',
  grade_level: '',
  section: '',
  face_encoding: '',
  face_descriptor: null as number[] | null
});

const loadStudents = async () => {
  loading.value = true;
  try {
    const res = await api.get('/students');
    if (res.success) {
      students.value = res.data;
    } else {
      toastStore.showToast(res.message || 'Failed to load students', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Network error loading students', 'error');
  } finally {
    loading.value = false;
  }
};

const openRegisterModal = () => {
  isEditing.value = false;
  editingId.value = null;
  form.value = {
    student_no: '',
    last_name: '',
    first_name: '',
    middle_name: '',
    grade_level: '',
    section: '',
    face_encoding: '',
    face_descriptor: null
  };
  showModal.value = true;
};

// Receive 128-d descriptor from WebcamCapture
const handleFaceDescriptor = (descriptor: number[]) => {
  form.value.face_descriptor = descriptor.length > 0 ? descriptor : null;
};

const openEditModal = (student: any) => {
  isEditing.value = true;
  editingId.value = student.student_id;
  form.value = {
    student_no: student.student_no,
    last_name: student.last_name,
    first_name: student.first_name,
    middle_name: student.middle_name || '',
    grade_level: student.grade_level || '',
    section: student.section || '',
    face_encoding: student.face_encoding || '',
    face_descriptor: null
  };
  showModal.value = true;
};

const handleSubmit = async () => {
  // Validate required fields
  if (!form.value.student_no || !form.value.last_name || !form.value.first_name) {
    toastStore.showToast('Please fill in Student No, Last Name, and First Name.', 'error');
    return;
  }

  // Face encoding is REQUIRED for new registration
  if (!isEditing.value && !form.value.face_encoding) {
    toastStore.showToast('Biometric face registration is required. Please complete face verification before submitting.', 'error');
    return;
  }

  try {
    let res;
    if (isEditing.value && editingId.value) {
      res = await api.put(`/students/${editingId.value}`, form.value);
    } else {
      res = await api.post('/students', {
        ...form.value,
        face_descriptor: form.value.face_descriptor ?? null
      });
    }

    if (res.success) {
      toastStore.showToast(res.message || 'Student saved successfully!', 'success');
      showModal.value = false;
      loadStudents();
    } else {
      toastStore.showToast(res.message || 'Failed to save student', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Server error saving student', 'error');
  }
};

const handleDelete = async (id: number) => {
  if (!confirm('Are you sure you want to delete this student? This will also remove attendance logs.')) return;
  
  try {
    const res = await api.delete(`/students/${id}`);
    if (res.success) {
      toastStore.showToast('Student deleted successfully!', 'success');
      loadStudents();
    } else {
      toastStore.showToast(res.message || 'Failed to delete student', 'error');
    }
  } catch (err) {
    console.error(err);
    toastStore.showToast('Server error deleting student', 'error');
  }
};

const filteredStudents = computed(() => {
  return students.value.filter((s) => {
    const matchGrade = !selectedGrade.value || s.grade_level === selectedGrade.value;
    const matchSection = !selectedSection.value || s.section === selectedSection.value;
    return matchGrade && matchSection;
  });
});

onMounted(() => {
  loadStudents();
});
</script>

<template>
  <div class="page-content">
    <Topbar title="Students" subtitle="Basic Education of Concepcion Holy Cross College, Inc." />

    <div class="controls-card card">
      <div class="header-row">
        <h2 class="section-title">Student Directory</h2>
        <button @click="openRegisterModal" class="btn btn-primary">
          ➕ Register Student
        </button>
      </div>

      <div class="filters-row">
        <div class="filter-group">
          <label>Grade Level</label>
          <select v-model="selectedGrade" class="filter-select">
            <option value="">All Grade Levels</option>
            <option value="Grade 1">Grade 1</option>
            <option value="Grade 2">Grade 2</option>
            <option value="Grade 3">Grade 3</option>
            <option value="Grade 4">Grade 4</option>
            <option value="Grade 5">Grade 5</option>
            <option value="Grade 6">Grade 6</option>
            <option value="Grade 7">Grade 7</option>
            <option value="Grade 8">Grade 8</option>
            <option value="Grade 9">Grade 9</option>
            <option value="Grade 10">Grade 10</option>
            <option value="Grade 11">Grade 11</option>
            <option value="Grade 12">Grade 12</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Section</label>
          <select v-model="selectedSection" class="filter-select">
            <option value="">All Sections</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="Newton">Newton</option>
            <option value="Einstein">Einstein</option>
            <option value="Archimedes">Archimedes</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="table-section" style="margin-top: 24px;">
      <DataTable
        :columns="columns"
        :data="filteredStudents"
        :loading="loading"
        searchPlaceholder="Search by number, last name, first name..."
      >
        <template #cell(student_no)="{ value, item }">
          <router-link :to="`/students/${item.student_id}`" class="student-link">
            {{ value }}
          </router-link>
        </template>
        <template #cell(actions)="{ item }">
          <div class="actions-wrapper">
            <button @click="openEditModal(item)" class="action-btn edit-btn" title="Edit Student">
              ✏️
            </button>
            <button @click="handleDelete(item.student_id)" class="action-btn delete-btn" title="Delete Student">
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
          <h3>{{ isEditing ? 'Edit Student Details' : 'Register New Student' }}</h3>
          <button @click="showModal = false" class="close-modal-btn">✕</button>
        </div>
        <div class="divider" style="margin: 16px 0;" />

        <form @submit.prevent="handleSubmit" class="modal-form">
          <div class="form-grid">
            <div class="form-fields">
              <div class="form-group">
                <label for="student_no" class="form-label">Student ID Number</label>
                <input
                  id="student_no"
                  type="text"
                  class="form-input"
                  v-model="form.student_no"
                  placeholder="e.g. CHCC-2026-0001"
                  required
                  :disabled="isEditing"
                />
              </div>

              <div class="form-group">
                <label for="first_name" class="form-label">First Name</label>
                <input
                  id="first_name"
                  type="text"
                  class="form-input"
                  v-model="form.first_name"
                  placeholder="First name"
                  required
                />
              </div>

              <div class="form-group">
                <label for="last_name" class="form-label">Last Name</label>
                <input
                  id="last_name"
                  type="text"
                  class="form-input"
                  v-model="form.last_name"
                  placeholder="Last name"
                  required
                />
              </div>

              <div class="form-group">
                <label for="middle_name" class="form-label">Middle Name</label>
                <input
                  id="middle_name"
                  type="text"
                  class="form-input"
                  v-model="form.middle_name"
                  placeholder="Middle name (optional)"
                />
              </div>

              <div class="form-group-row">
                <div class="form-group">
                  <label for="grade_level" class="form-label">Grade Level</label>
                  <select id="grade_level" v-model="form.grade_level" class="form-input" required>
                    <option value="">Select level</option>
                    <option value="Grade 1">Grade 1</option>
                    <option value="Grade 2">Grade 2</option>
                    <option value="Grade 3">Grade 3</option>
                    <option value="Grade 4">Grade 4</option>
                    <option value="Grade 5">Grade 5</option>
                    <option value="Grade 6">Grade 6</option>
                    <option value="Grade 7">Grade 7</option>
                    <option value="Grade 8">Grade 8</option>
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>

                <div class="form-group">
                  <label for="section" class="form-label">Section</label>
                  <select id="section" v-model="form.section" class="form-input" required>
                    <option value="">Select section</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="Newton">Newton</option>
                    <option value="Einstein">Einstein</option>
                    <option value="Archimedes">Archimedes</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Face Registration Webcam Capture -->
            <div class="webcam-column">
              <label class="form-label">🔍 Biometric Face Registration</label>
              <div class="webcam-frame">
                <WebcamCapture
                  v-model="form.face_encoding"
                  @face-descriptor="handleFaceDescriptor"
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

.filter-select {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--divider);
  font-family: inherit;
  font-weight: 600;
  background: white;
  outline: none;
  transition: var(--transition);
}

.filter-select:focus {
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
  background: #f1f5f9;
  color: var(--text-main);
  border: 1.5px solid var(--divider);
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.student-link {
  color: var(--primary);
  font-weight: 700;
  text-decoration: none;
}

.student-link:hover {
  text-decoration: underline;
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
  max-width: 900px;
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

.webcam-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.webcam-frame {
  width: 100%;
}

.webcam-tip {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  line-height: 1.4;
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
