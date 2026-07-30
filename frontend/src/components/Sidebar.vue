<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>' },
  { href: '/students', label: 'Students', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>' },
  { href: '/parents', label: 'Parents (Staying)', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
  { href: '/guards', label: 'Staff & Guards', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' },
  { href: '/attendance', label: 'Attendance Logs', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>' },
  { href: '/reports', label: 'Reports', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>' },
  { href: '/teachers', label: 'Teachers', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>' },
  { href: '/payroll', label: 'Payroll', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>' },
  { href: '/payslips', label: 'Payslips', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>' },
  { href: '/sms-logs', label: 'SMS Logs', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
  { href: '/settings', label: 'System Settings', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' },
];

const authStore = useAuthStore();
const route = useRoute();
const isOpen = ref(false);

const handleLogout = () => {
  authStore.logout();
  window.location.href = '/login';
};
</script>

<template>
  <div>
    <button
      @click="isOpen = true"
      class="mobileToggle"
    >
      ☰
    </button>

    <div
      :class="['sidebar-overlay', { active: isOpen }]"
      @click="isOpen = false"
    />

    <aside :class="['sidebar', { 'sidebar-open': isOpen }]">
      <button
        @click="isOpen = false"
        class="closeBtn"
      >
        ✕
      </button>

      <div class="header">
        <div class="logoWrapper">
          <img src="/images/chcc_circle.png" alt="CHCC Logo" class="logoImage" />
        </div>
        <div class="branding">
          <div class="schoolName">Basic Education of Concepcion Holy Cross College, Inc.</div>
        </div>
      </div>

      <div class="divider" />

      <nav class="nav">
        <router-link
          v-for="item in navItems"
          :key="item.href"
          :to="item.href"
          :class="['navItem', { active: route.path === item.href }]"
          @click="isOpen = false"
        >
          <span class="navIcon" v-html="item.icon"></span>
          <span class="navText">{{ item.label }}</span>
        </router-link>
      </nav>

      <div class="bottom">
        <div class="studentCard">
          <img src="/images/chcc_circle.png" alt="Admin Avatar" class="studentAvatar" style="object-fit: cover;" />
          <div class="studentInfo">
            <div class="studentName">{{ authStore.user?.full_name }}</div>
            <div class="studentMeta">Administrator</div>
          </div>
        </div>
        <button class="logoutBtn" @click="handleLogout">
          <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></span> Sign Out
        </button>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  width: var(--sidebar-width);
  height: 100vh;
  background: #1e3a5f;
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 40px 24px;
  z-index: 100;
  border-right: 1px solid rgba(255, 255, 255, 0.05);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar::-webkit-scrollbar {
  width: 5px;
}

.sidebar::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

@media (max-width: 1024px) {
  .sidebar {
    transform: translateX(-100%);
    width: 280px;
  }
}

.mobileToggle {
  display: none !important;
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 101;
  background: #1e3a5f;
  color: white;
  border: none;
  border-radius: 12px;
  width: 50px;
  height: 50px;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
  align-items: center;
  justify-content: center;
}

@media (max-width: 1024px) {
  .mobileToggle {
    display: flex !important;
    top: 12px;
    left: 14px;
    width: 44px;
    height: 44px;
    font-size: 20px;
    border-radius: 14px;
  }
}

.closeBtn {
  display: none !important;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  color: #fff;
  font-weight: 900;
  cursor: pointer;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1024px) {
  .closeBtn {
    display: flex !important;
    margin-left: auto;
    margin-bottom: 32px;
  }
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 20px;
  margin-bottom: 48px;
}

.logoWrapper {
  width: 96px;
  height: 96px;
  background: white;
  border: 3px solid #f5a623;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.logoWrapper:hover {
  transform: translateY(-8px) rotate(3deg);
}

.logoImage {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: 50%;
  object-fit: cover;
}

.branding {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.schoolName {
  font-size: 12px;
  font-weight: 950;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  line-height: 1.4;
  opacity: 0.95;
}

.tagline {
  font-size: 14px;
  text-transform: uppercase;
  font-weight: 800;
  color: #f5a623;
  letter-spacing: 4px;
}

.divider {
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.1), transparent);
  margin: 12px 0 40px;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.navItem {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-radius: 16px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  font-size: 13px;
  font-weight: 800;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.navItem:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  transform: translateX(8px);
}

.navItem.active {
  background: #f5a623;
  color: #1e3a5f;
  box-shadow: 0 10px 25px rgba(245, 166, 35, 0.3);
}

.navItem.active .navIcon {
  color: #1e3a5f;
}

.navIcon {
  font-size: 20px;
  width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom {
  margin-top: auto;
  padding-top: 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.studentCard {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: 0.3s;
}

.studentCard:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.studentAvatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #f5a623;
  color: #1e3a5f;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 950;
  font-size: 18px;
  flex-shrink: 0;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
}

.studentInfo {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.studentName {
  font-size: 14px;
  font-weight: 900;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.studentMeta {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 700;
  margin-top: 2px;
}

.logoutBtn {
  width: 100%;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  padding: 16px;
  border-radius: 16px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  font-weight: 950;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  transition: all 0.3s;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.logoutBtn:hover {
  background: #ef4444;
  color: white;
  border-color: #ef4444;
  box-shadow: 0 10px 20px rgba(239, 68, 68, 0.3);
  transform: translateY(-2px);
}

.scanner-action-btn {
  width: 100%;
  padding: 14px 18px;
  border-radius: 16px;
  border: 1px solid rgba(0, 196, 122, 0.4);
  background: linear-gradient(135deg, rgba(0, 196, 122, 0.15), rgba(16, 185, 129, 0.08));
  color: #00c47a;
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(0, 196, 122, 0.1);
}

.scanner-action-btn:hover {
  background: linear-gradient(135deg, #00c47a, #10b981);
  color: #fff;
  border-color: #00c47a;
  box-shadow: 0 8px 20px rgba(0, 196, 122, 0.35);
  transform: translateY(-2px);
}

.scanner-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
