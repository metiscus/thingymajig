// src/stores/authStore.js
import { defineStore } from 'pinia';
import { httpAPI } from '../services/httpAPI';
import router from '../router'; // Import router instance directly

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    isAdmin: false,
  }),

  actions: {
    async login(email, password) {
      try {
        const response = await httpAPI.login(email, password);
        
        console.log('Auth store received:', response);
        
        // Store the token IMMEDIATELY before making any other requests
        this.token = response.access_token;
        localStorage.setItem('jwt_token', response.access_token);
        
        console.log('Token stored:', localStorage.getItem('jwt_token')?.substring(0, 20) + '...');
        
        // Now get user info (token is available for the request)
        await this.fetchCurrentUser();
        
        // Navigate to main app using router instance
        router.push('/');
      } catch (error) {
        console.error('Login failed:', error);
        throw error;
      }
    },

    async register(email, password) {
      try {
        await httpAPI.register(email, password);
        // After successful registration, redirect to login
        router.push('/login');
      } catch (error) {
        console.error('Registration failed:', error);
        throw error;
      }
    },

    async fetchCurrentUser() {
      try {
        const storedToken = localStorage.getItem('jwt_token');
        console.log('About to fetch user with token:', storedToken?.substring(0, 20) + '...');
        
        const userData = await httpAPI.getCurrentUser();
        console.log('User data received:', userData);
        
        this.user = userData;
        this.isAuthenticated = true;
        this.isAdmin = userData.is_superuser || false;
      } catch (error) {
        console.error('Failed to fetch current user:', error);
        this.logout();
        throw error;
      }
    },

    async logout() {
      try {
        // Only attempt server logout if we have a token
        if (this.token || localStorage.getItem('jwt_token')) {
          await httpAPI.logout();
        }
      } catch (error) {
        console.error('Logout error:', error);
        // Continue with local logout even if server logout fails
      } finally {
        // Clear state regardless of server response
        this.user = null;
        this.token = null;
        this.isAuthenticated = false;
        this.isAdmin = false;
        localStorage.removeItem('jwt_token');
        
        // Navigate to login using router instance
        router.push('/login');
      }
    },

    async initializeAuth() {
      // Check if user is already logged in (token in localStorage)
      const token = localStorage.getItem('jwt_token');
      if (token) {
        this.token = token;
        try {
          await this.fetchCurrentUser();
        } catch (error) {
          // Token is invalid, clear it
          this.logout();
        }
      }
    },
  },
});