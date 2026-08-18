<template>
  <div class="min-h-screen bg-gradient-to-br from-surface-950 via-surface-900 to-surface-950 relative overflow-x-hidden">
    <!-- Animated background orbs -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden">
      <div class="absolute -top-40 -left-40 w-96 h-96 bg-accent-600/10 rounded-full blur-3xl animate-pulse-slow"></div>
      <div class="absolute top-1/3 -right-32 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse-slow" style="animation-delay: 1s;"></div>
      <div class="absolute -bottom-40 left-1/3 w-96 h-96 bg-teal-600/8 rounded-full blur-3xl animate-pulse-slow" style="animation-delay: 2s;"></div>
    </div>

    <!-- Content -->
    <div class="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">

      <!-- ==================== TOP BAR ==================== -->
      <header class="py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <!-- Logo & Title -->
        <div class="flex items-center gap-3">
          <!-- Shield icon -->
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-500 to-accent-700 flex items-center justify-center shadow-glow">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">
              SAMS <span class="text-accent-400">—</span> <span class="text-surface-300 font-medium">Live Campus Monitor</span>
            </h1>
          </div>
        </div>

        <!-- Live badge + Clock -->
        <div class="flex items-center gap-5">
          <!-- LIVE badge -->
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-500/15 border border-success-500/30">
            <span class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-success-500"></span>
            </span>
            <span class="text-success-400 text-xs font-bold tracking-widest uppercase">Live</span>
          </div>

          <!-- Clock -->
          <div class="text-right">
            <div class="text-lg sm:text-xl font-semibold text-white tabular-nums tracking-tight">
              {{ currentTime }}
            </div>
            <div class="text-xs text-surface-400 font-medium">
              {{ currentDate }}
            </div>
          </div>
        </div>
      </header>

      <!-- ==================== METRICS ROW ==================== -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 animate-fade-in">
        <!-- Students Inside -->
        <div class="glass-card-hover p-4 sm:p-5 group">
          <div class="flex items-start justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center group-hover:bg-blue-500/25 transition-colors">
              <svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
            </div>
            <span class="text-[10px] font-medium text-blue-400/70 uppercase tracking-wider">Students</span>
          </div>
          <div class="text-3xl sm:text-4xl font-extrabold text-white mb-1 tabular-nums">
            {{ loading ? '—' : students.length }}
          </div>
          <div class="text-xs text-surface-400">Currently inside campus</div>
        </div>

        <!-- Teachers Inside -->
        <div class="glass-card-hover p-4 sm:p-5 group">
          <div class="flex items-start justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-teal-500/15 flex items-center justify-center group-hover:bg-teal-500/25 transition-colors">
              <svg class="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <span class="text-[10px] font-medium text-teal-400/70 uppercase tracking-wider">Teachers</span>
          </div>
          <div class="text-3xl sm:text-4xl font-extrabold text-white mb-1 tabular-nums">
            {{ loading ? '—' : teachers.length }}
          </div>
          <div class="text-xs text-surface-400">Currently inside campus</div>
        </div>

        <!-- Grade Levels Present -->
        <div class="glass-card-hover p-4 sm:p-5 group">
          <div class="flex items-start justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center group-hover:bg-purple-500/25 transition-colors">
              <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
            </div>
            <span class="text-[10px] font-medium text-purple-400/70 uppercase tracking-wider">Grades</span>
          </div>
          <div class="text-3xl sm:text-4xl font-extrabold text-white mb-1 tabular-nums">
            {{ loading ? '—' : gradeLevelsPresent }}
          </div>
          <div class="text-xs text-surface-400">Grade levels present</div>
        </div>

        <!-- Total on Campus -->
        <div class="glass-card-hover p-4 sm:p-5 group relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-br from-accent-600/10 to-transparent pointer-events-none"></div>
          <div class="relative">
            <div class="flex items-start justify-between mb-3">
              <div class="w-10 h-10 rounded-xl bg-accent-500/15 flex items-center justify-center group-hover:bg-accent-500/25 transition-colors">
                <svg class="w-5 h-5 text-accent-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
              </div>
              <span class="text-[10px] font-medium text-accent-400/70 uppercase tracking-wider">Total</span>
            </div>
            <div class="text-3xl sm:text-4xl font-extrabold text-white mb-1 tabular-nums">
              {{ loading ? '—' : totalOnCampus }}
            </div>
            <div class="text-xs text-surface-400">Total on campus</div>
          </div>
        </div>
      </div>

      <!-- ==================== SEARCH & FILTER BAR ==================== -->
      <div class="glass-card p-3 sm:p-4 mb-8 flex flex-col sm:flex-row gap-3 animate-fade-in" style="animation-delay: 0.1s;">
        <!-- Search Input -->
        <div class="relative flex-1">
          <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name..."
            class="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500/50 transition-all"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-surface-400 hover:text-white transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Grade Filter -->
        <div class="relative sm:w-56">
          <select
            v-model="gradeFilter"
            class="w-full appearance-none pl-4 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500/50 transition-all cursor-pointer"
          >
            <option value="" class="bg-surface-800">All Grade Levels</option>
            <option
              v-for="grade in availableGrades"
              :key="grade"
              :value="grade"
              class="bg-surface-800"
            >
              {{ grade }}
            </option>
          </select>
          <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <svg class="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      </div>

      <!-- ==================== LOADING STATE ==================== -->
      <div v-if="loading" class="space-y-6 animate-fade-in">
        <!-- Skeleton metrics already handled above -->
        <!-- Skeleton section -->
        <div class="glass-card p-6">
          <div class="shimmer-bg h-7 w-48 mb-6"></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div v-for="i in 8" :key="i" class="bg-white/5 rounded-xl p-4 space-y-3">
              <div class="flex items-center gap-3">
                <div class="shimmer-bg w-10 h-10 rounded-full"></div>
                <div class="space-y-2 flex-1">
                  <div class="shimmer-bg h-4 w-3/4"></div>
                  <div class="shimmer-bg h-3 w-1/2"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="glass-card p-6">
          <div class="shimmer-bg h-7 w-36 mb-6"></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <div v-for="i in 4" :key="i" class="bg-white/5 rounded-xl p-4 space-y-3">
              <div class="flex items-center gap-3">
                <div class="shimmer-bg w-10 h-10 rounded-full"></div>
                <div class="space-y-2 flex-1">
                  <div class="shimmer-bg h-4 w-3/4"></div>
                  <div class="shimmer-bg h-3 w-1/2"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== ERROR STATE ==================== -->
      <div v-else-if="error" class="glass-card p-8 sm:p-12 text-center animate-fade-in">
        <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/15 flex items-center justify-center">
          <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h3 class="text-lg font-semibold text-white mb-2">Unable to Load Data</h3>
        <p class="text-surface-400 text-sm mb-6 max-w-md mx-auto">
          {{ error }}
        </p>
        <button
          @click="fetchAllData"
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium rounded-xl transition-all hover:shadow-glow active:scale-95"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
          Retry
        </button>
      </div>

      <!-- ==================== DATA LOADED ==================== -->
      <div v-else class="space-y-6">

        <!-- ========== STUDENTS SECTION ========== -->
        <section class="animate-fade-in" style="animation-delay: 0.15s;">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.627 48.627 0 0 1 12 20.904a48.627 48.627 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
            </div>
            <h2 class="text-lg font-bold text-white">Students Inside</h2>
            <span class="text-xs font-medium text-surface-400 bg-white/5 px-2.5 py-1 rounded-full">
              {{ filteredStudents.length }} total
            </span>
          </div>

          <!-- Empty state -->
          <div v-if="filteredStudents.length === 0" class="glass-card p-8 sm:p-12 text-center">
            <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-surface-800 flex items-center justify-center">
              <svg class="w-7 h-7 text-surface-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            </div>
            <p class="text-surface-400 text-sm">
              {{ searchQuery || gradeFilter ? 'No students match your search criteria.' : 'No students currently inside campus.' }}
            </p>
          </div>

          <!-- Grade Level Groups -->
          <div v-else class="space-y-3">
            <div
              v-for="(group, index) in groupedStudents"
              :key="group.grade"
              class="glass-card overflow-hidden animate-slide-up"
              :style="{ animationDelay: `${index * 0.05}s` }"
            >
              <!-- Group Header (Collapsible) -->
              <button
                @click="toggleGrade(group.grade)"
                class="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
              >
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-500/20 to-purple-500/20 flex items-center justify-center text-sm font-bold text-accent-300">
                    {{ extractGradeNumber(group.grade) }}
                  </div>
                  <span class="font-semibold text-white text-sm sm:text-base">{{ group.grade }}</span>
                  <span class="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-bold rounded-full bg-accent-500/20 text-accent-300">
                    {{ group.students.length }}
                  </span>
                </div>
                <svg
                  class="w-5 h-5 text-surface-400 transition-transform duration-300 group-hover:text-white"
                  :class="{ 'rotate-180': expandedGrades.has(group.grade) }"
                  fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              <!-- Group Content -->
              <div
                v-show="expandedGrades.has(group.grade)"
                class="px-4 pb-4"
              >
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  <div
                    v-for="(student, sIndex) in group.students"
                    :key="student.id || sIndex"
                    class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-all duration-200"
                  >
                    <!-- Avatar -->
                    <div
                      class="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg"
                      :style="{ backgroundColor: avatarColors[sIndex % avatarColors.length] }"
                    >
                      {{ getInitials(student.full_name) }}
                    </div>
                    <!-- Info -->
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-white truncate">
                        {{ student.full_name }}
                      </p>
                      <div class="flex items-center gap-2 text-xs text-surface-400">
                        <span class="truncate">{{ student.section || '—' }}</span>
                        <span class="text-surface-600">•</span>
                        <span class="shrink-0 text-accent-400/80">{{ formatTime(student.arrival_time) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ========== DIVIDER ========== -->
        <div class="relative py-2">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-white/[0.06]"></div>
          </div>
          <div class="relative flex justify-center">
            <div class="bg-surface-900 px-4 flex items-center gap-2">
              <div class="w-1.5 h-1.5 rounded-full bg-accent-500/50"></div>
              <div class="w-1 h-1 rounded-full bg-accent-500/30"></div>
              <div class="w-0.5 h-0.5 rounded-full bg-accent-500/20"></div>
            </div>
          </div>
        </div>

        <!-- ========== TEACHERS SECTION ========== -->
        <section class="animate-fade-in" style="animation-delay: 0.25s;">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <svg class="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <h2 class="text-lg font-bold text-white">Teachers Inside</h2>
            <span class="text-xs font-medium text-surface-400 bg-white/5 px-2.5 py-1 rounded-full">
              {{ filteredTeachers.length }} total
            </span>
          </div>

          <!-- Empty state -->
          <div v-if="filteredTeachers.length === 0" class="glass-card p-8 sm:p-12 text-center">
            <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-surface-800 flex items-center justify-center">
              <svg class="w-7 h-7 text-surface-500" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            <p class="text-surface-400 text-sm">
              {{ searchQuery ? 'No teachers match your search criteria.' : 'No teachers currently inside campus.' }}
            </p>
          </div>

          <!-- Teachers Grid -->
          <div v-else class="glass-card p-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              <div
                v-for="(teacher, tIndex) in filteredTeachers"
                :key="teacher.id || tIndex"
                class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-white/10 transition-all duration-200"
              >
                <!-- Avatar -->
                <div
                  class="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg"
                  :style="{ backgroundColor: avatarColors[tIndex % avatarColors.length] }"
                >
                  {{ getInitials(teacher.full_name) }}
                </div>
                <!-- Info -->
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-white truncate">
                    {{ teacher.full_name }}
                  </p>
                  <div class="flex items-center gap-2 text-xs text-surface-400">
                    <span class="truncate">{{ teacher.subject || '—' }}</span>
                    <span class="text-surface-600">•</span>
                    <span class="shrink-0 text-teal-400/80">{{ formatTime(teacher.arrival_time) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- ==================== FOOTER / LAST UPDATED ==================== -->
      <div class="mt-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-surface-500">
        <div class="flex items-center gap-2">
          <div class="w-1.5 h-1.5 rounded-full" :class="loading ? 'bg-warning-400 animate-pulse' : 'bg-success-500'"></div>
          <span>
            {{ loading ? 'Refreshing data...' : `Last updated: ${lastUpdatedFormatted}` }}
          </span>
        </div>
        <div class="flex items-center gap-1.5 text-surface-600">
          <span>Auto-refresh every 30s</span>
          <span>•</span>
          <button @click="fetchAllData" class="text-accent-400 hover:text-accent-300 transition-colors font-medium">
            Refresh now
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import dayjs from 'dayjs'

// ─── Constants ───────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

const avatarColors = ['#3B82F6', '#14B8A6', '#8B5CF6', '#F97316', '#22C55E']

// ─── Reactive State ──────────────────────────────────────────
const students = ref([])
const teachers = ref([])
const loading = ref(true)
const error = ref(null)
const searchQuery = ref('')
const gradeFilter = ref('')
const expandedGrades = ref(new Set())
const lastUpdated = ref(null)

// Clock
const currentTime = ref('')
const currentDate = ref('')

// Timers
let clockInterval = null
let refreshInterval = null

// ─── Computed ────────────────────────────────────────────────
const gradeLevelsPresent = computed(() => {
  const grades = new Set(students.value.map(s => s.grade_level).filter(Boolean))
  return grades.size
})

const totalOnCampus = computed(() => {
  return students.value.length + teachers.value.length
})

const availableGrades = computed(() => {
  const grades = [...new Set(students.value.map(s => s.grade_level).filter(Boolean))]
  return grades.sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0
    const numB = parseInt(b.replace(/\D/g, '')) || 0
    return numA - numB
  })
})

const filteredStudents = computed(() => {
  let result = students.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(s => {
      return (s.full_name || '').toLowerCase().includes(q)
    })
  }

  if (gradeFilter.value) {
    result = result.filter(s => s.grade_level === gradeFilter.value)
  }

  return result
})

const filteredTeachers = computed(() => {
  if (!searchQuery.value) return teachers.value

  const q = searchQuery.value.toLowerCase()
  return teachers.value.filter(t => {
    return (t.full_name || '').toLowerCase().includes(q)
  })
})

const groupedStudents = computed(() => {
  const groups = {}
  filteredStudents.value.forEach(student => {
    const grade = student.grade_level || 'Unassigned'
    if (!groups[grade]) {
      groups[grade] = []
    }
    groups[grade].push(student)
  })

  return Object.keys(groups)
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0
      const numB = parseInt(b.replace(/\D/g, '')) || 0
      return numA - numB
    })
    .map(grade => ({
      grade,
      students: groups[grade]
    }))
})

const lastUpdatedFormatted = computed(() => {
  if (!lastUpdated.value) return 'Never'
  return dayjs(lastUpdated.value).format('h:mm:ss A')
})

// ─── Methods ─────────────────────────────────────────────────
function updateClock() {
  const now = dayjs()
  currentTime.value = now.format('hh:mm:ss A')
  currentDate.value = now.format('MMMM D, YYYY')
}

function getInitials(fullName) {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.charAt(0).toUpperCase() || ''
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : ''
  return `${first}${last}` || '?'
}

function formatTime(time) {
  if (!time) return '—'
  return dayjs(time).format('h:mm A')
}

function extractGradeNumber(gradeStr) {
  const match = (gradeStr || '').match(/\d+/)
  return match ? match[0] : '?'
}

function toggleGrade(grade) {
  const newSet = new Set(expandedGrades.value)
  if (newSet.has(grade)) {
    newSet.delete(grade)
  } else {
    newSet.add(grade)
  }
  expandedGrades.value = newSet
}

async function fetchAllData() {
  try {
    loading.value = true
    error.value = null

    const [studentsRes, teachersRes] = await Promise.all([
      axios.get(`${API_BASE}/monitor/students-inside`),
      axios.get(`${API_BASE}/monitor/teachers-inside`)
    ])

    students.value = studentsRes.data || []
    teachers.value = teachersRes.data || []

    lastUpdated.value = new Date()

    // Auto-expand all grades on first load
    if (expandedGrades.value.size === 0) {
      const allGrades = [...new Set(students.value.map(s => s.grade_level).filter(Boolean))]
      expandedGrades.value = new Set(allGrades)
    }
  } catch (err) {
    console.error('Failed to fetch data:', err)
    error.value = err.response?.data?.message || err.message || 'Failed to connect to the server. Please check if the backend is running.'
  } finally {
    loading.value = false
  }
}

// ─── Lifecycle ───────────────────────────────────────────────
onMounted(() => {
  // Start clock
  updateClock()
  clockInterval = setInterval(updateClock, 1000)

  // Initial fetch
  fetchAllData()

  // Auto-refresh every 30 seconds
  refreshInterval = setInterval(fetchAllData, 30000)
})

onUnmounted(() => {
  if (clockInterval) clearInterval(clockInterval)
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>
