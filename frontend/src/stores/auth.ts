import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/lib/api';

export interface User {
  admin_id: number;
  username: string;
  full_name: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const loading = ref(true);

  // Initialize from storage
  function init() {
    const savedToken = localStorage.getItem('sams_token');
    const savedUser = localStorage.getItem('sams_user');
    if (savedToken && savedUser) {
      token.value = savedToken;
      user.value = JSON.parse(savedUser);
    }
    loading.value = false;
  }

  async function login(username: string, password: string) {
    try {
      const res = await api.post('/auth/login', { username, password });
      if (res.success) {
        token.value = res.token;
        user.value = res.user;
        localStorage.setItem('sams_token', res.token);
        localStorage.setItem('sams_user', JSON.stringify(res.user));
        return { success: true };
      }
      return { success: false, message: res.message };
    } catch {
      return { success: false, message: 'Cannot connect to server. Make sure the backend is running.' };
    }
  }

  function logout() {
    user.value = null;
    token.value = null;
    localStorage.removeItem('sams_token');
    localStorage.removeItem('sams_user');
  }

  return {
    user,
    token,
    loading,
    init,
    login,
    logout,
  };
});
