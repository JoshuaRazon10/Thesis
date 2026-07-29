<script setup lang="ts">
import { ref, computed } from 'vue';

interface Column {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
}

const props = withDefaults(
  defineProps<{
    columns: Column[];
    data: any[];
    searchable?: boolean;
    searchPlaceholder?: string;
    loading?: boolean;
  }>(),
  {
    searchable: true,
    searchPlaceholder: 'Search...',
    loading: false,
  }
);

// Search state
const searchQuery = ref('');

// Sorting state
const sortKey = ref('');
const sortOrder = ref<'asc' | 'desc'>('asc');

// Pagination state
const currentPage = ref(1);
const itemsPerPage = ref(10);

const handleSort = (key: string) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortOrder.value = 'asc';
  }
};

// Filtered and sorted data
const processedData = computed(() => {
  let result = [...props.data];

  // Apply search query
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter((row) => {
      return props.columns.some((col) => {
        const val = row[col.key];
        return val ? String(val).toLowerCase().includes(q) : false;
      });
    });
  }

  // Apply sorting
  if (sortKey.value) {
    result.sort((a, b) => {
      let valA = a[sortKey.value];
      let valB = b[sortKey.value];

      if (valA === null || valA === undefined) valA = '';
      if (valB === null || valB === undefined) valB = '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder.value === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      } else {
        return sortOrder.value === 'asc'
          ? (valA > valB ? 1 : -1)
          : (valA < valB ? 1 : -1);
      }
    });
  }

  return result;
});

// Paginated data
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return processedData.value.slice(start, start + itemsPerPage.value);
});

// Total pages
const totalPages = computed(() => {
  return Math.ceil(processedData.value.length / itemsPerPage.value) || 1;
});

// Page change
const setPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page;
  }
};
</script>

<template>
  <div class="datatable-container">
    <!-- Top Bar with Search & Pagination Size -->
    <div class="datatable-header" v-if="searchable">
      <div class="search-wrapper">
        <span class="search-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block; color: var(--text-muted);"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </span>
        <input
          type="text"
          v-model="searchQuery"
          :placeholder="searchPlaceholder"
          class="search-input"
          @input="currentPage = 1"
        />
      </div>
      <div class="per-page-selector">
        <label>Show</label>
        <select v-model="itemsPerPage" class="per-page-select" @change="currentPage = 1">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
        </select>
        <span>entries</span>
      </div>
    </div>

    <!-- Table Frame -->
    <div class="table-responsive">
      <table class="custom-table">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              :style="{ width: col.width }"
              :class="{ sortable: col.sortable !== false }"
              @click="col.sortable !== false ? handleSort(col.key) : null"
            >
              <div class="th-content">
                {{ col.label }}
                <span v-if="col.sortable !== false" class="sort-icon">
                  <template v-if="sortKey === col.key">
                    {{ sortOrder === 'asc' ? ' ▲' : ' ▼' }}
                  </template>
                  <template v-else>
                    ⇅
                  </template>
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading State -->
          <tr v-if="loading">
            <td :colspan="columns.length" class="text-center py-5">
              <div class="spinner"></div>
            </td>
          </tr>
          <!-- Empty State -->
          <tr v-else-if="paginatedData.length === 0">
            <td :colspan="columns.length" class="empty-state">
              <div class="empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted); opacity: 0.6; display: inline-block;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <p>No matching records found.</p>
            </td>
          </tr>
          <!-- Rows -->
          <tr v-else v-for="(row, idx) in paginatedData" :key="idx" class="table-row">
            <td v-for="col in columns" :key="col.key">
              <slot :name="`cell(${col.key})`" :item="row" :value="row[col.key]">
                {{ row[col.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination Footer -->
    <div class="datatable-footer" v-if="!loading && processedData.length > 0">
      <div class="info-text">
        Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to
        {{ Math.min(currentPage * itemsPerPage, processedData.length) }} of
        {{ processedData.length }} entries
      </div>
      <div class="pagination-buttons">
        <button
          @click="setPage(currentPage - 1)"
          :disabled="currentPage === 1"
          class="page-btn prev-btn"
        >
          Previous
        </button>
        <button
          v-for="page in totalPages"
          :key="page"
          @click="setPage(page)"
          :class="['page-btn', { active: currentPage === page }]"
        >
          {{ page }}
        </button>
        <button
          @click="setPage(currentPage + 1)"
          :disabled="currentPage === totalPages"
          class="page-btn next-btn"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.datatable-container {
  background: white;
  border-radius: var(--radius-lg);
  border: 1px solid var(--divider);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.datatable-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1.5px solid var(--divider);
  gap: 16px;
  flex-wrap: wrap;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 16px;
  font-size: 14px;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  padding: 12px 16px 12px 44px;
  border-radius: 9999px;
  border: 1.5px solid var(--divider);
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-main);
  background: #f8fafc;
  outline: none;
  transition: var(--transition);
}

.search-input:focus {
  border-color: var(--primary);
  background: white;
  box-shadow: 0 0 0 4px rgba(30, 58, 95, 0.08);
}

.per-page-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-muted);
}

.per-page-select {
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--divider);
  font-family: inherit;
  font-weight: 700;
  background: white;
  outline: none;
}

.table-responsive {
  width: 100%;
  overflow-x: auto;
}

.custom-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.custom-table th {
  background: #f8fafc;
  color: var(--primary-dark);
  font-weight: 800;
  font-size: 13.5px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 16px 24px;
  border-bottom: 1.5px solid var(--divider);
  user-select: none;
}

.custom-table th.sortable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.custom-table th.sortable:hover {
  background: var(--secondary);
  color: var(--primary);
}

.th-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sort-icon {
  font-size: 11px;
  opacity: 0.6;
}

.custom-table td {
  padding: 18px 24px;
  font-size: 14.5px;
  font-weight: 500;
  color: var(--text-main);
  border-bottom: 1px solid var(--divider);
  vertical-align: middle;
}

.table-row {
  transition: all 0.2s ease;
}

.table-row:hover {
  background: rgba(30, 58, 95, 0.02);
}

.empty-state {
  text-align: center;
  padding: 60px 24px !important;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.empty-state p {
  font-weight: 600;
  font-size: 15px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--secondary);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: rotate 0.8s linear infinite;
  margin: 20px auto;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.datatable-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-top: 1.5px solid var(--divider);
  gap: 16px;
  flex-wrap: wrap;
}

.info-text {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-muted);
}

.pagination-buttons {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-btn {
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--divider);
  background: white;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s ease;
}

.page-btn:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--secondary);
}

.page-btn.active {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .datatable-header, .datatable-footer {
    flex-direction: column;
    align-items: stretch;
  }
  .search-wrapper {
    max-width: none;
  }
  .pagination-buttons {
    justify-content: center;
  }
  .info-text {
    text-align: center;
  }
}
</style>
