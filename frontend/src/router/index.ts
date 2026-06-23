import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

// Public Views
import HomeView from '@/views/HomeView.vue';
import LoginView from '@/views/LoginView.vue';

// Layout
import PortalLayout from '@/views/PortalLayout.vue';

// SAMS Views
import Dashboard from '@/views/Dashboard.vue';
import Students from '@/views/Students.vue';
import StudentProfile from '@/views/StudentProfile.vue';
import Parents from '@/views/Parents.vue';
import Guards from '@/views/Guards.vue';
import AttendanceLogs from '@/views/AttendanceLogs.vue';
import Reports from '@/views/Reports.vue';
import Teachers from '@/views/Teachers.vue';
import TeacherDTR from '@/views/TeacherDTR.vue';
import Payroll from '@/views/Payroll.vue';
import Payslips from '@/views/Payslips.vue';
import SmsLogs from '@/views/SmsLogs.vue';
import Settings from '@/views/Settings.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeView,
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
  },
  {
    path: '/',
    component: PortalLayout,
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: Dashboard,
      },
      {
        path: 'students',
        name: 'Students',
        component: Students,
      },
      {
        path: 'students/:id',
        name: 'StudentProfile',
        component: StudentProfile,
      },
      {
        path: 'parents',
        name: 'Parents',
        component: Parents,
      },
      {
        path: 'guards',
        name: 'Guards',
        component: Guards,
      },
      {
        path: 'attendance',
        name: 'AttendanceLogs',
        component: AttendanceLogs,
      },
      {
        path: 'reports',
        name: 'Reports',
        component: Reports,
      },
      {
        path: 'teachers',
        name: 'Teachers',
        component: Teachers,
      },
      {
        path: 'teachers/:id/dtr',
        name: 'TeacherDTR',
        component: TeacherDTR,
      },
      {
        path: 'payroll',
        name: 'Payroll',
        component: Payroll,
      },
      {
        path: 'payslips',
        name: 'Payslips',
        component: Payslips,
      },
      {
        path: 'sms-logs',
        name: 'SmsLogs',
        component: SmsLogs,
      },
      {
        path: 'settings',
        name: 'Settings',
        component: Settings,
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();
  
  // Make sure auth is initialized
  if (authStore.loading) {
    authStore.init();
  }

  const isAuthenticated = !!authStore.token;

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login');
  } else if (to.name === 'Login' && isAuthenticated) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
