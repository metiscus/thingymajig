// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

// Import your components
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import RatesManager from '../components/RatesManager.vue';
import GlobalMaterialManager from '../components/GlobalMaterialManager.vue';

const routes = [
  // Authentication routes (shown when not authenticated)
  {
    path: '/login',
    name: 'Login',
    component: Login,
    meta: { requiresGuest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: Register,
    meta: { requiresGuest: true }
  },
  
  // Main app routes (shown when authenticated)
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/project/new',
    name: 'NewProject',
    components: {
      mainContent: () => import('../views/ProjectView.vue')
    },
    meta: { requiresAuth: true }
  },
  {
    path: '/project/:projectId',
    name: 'ProjectDetails',
    components: {
      mainContent: () => import('../views/ProjectView.vue')
    },
    props: {
      mainContent: true
    },
    meta: { requiresAuth: true }
  },
  {
    path: '/settings/rates',
    name: 'ManageRates',
    components: {
      mainContent: RatesManager
    },
    meta: { requiresAuth: true }
  },
  {
    path: '/settings/materials',
    name: 'ManageGlobalMaterials',
    components: {
      mainContent: GlobalMaterialManager
    },
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: () => import('../views/AdminDashboard.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  
  // Catch-all redirect
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  
  // Initialize auth if not already done
  if (!authStore.isAuthenticated && localStorage.getItem('jwt_token')) {
    try {
      await authStore.initializeAuth();
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }
  }

  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const requiresGuest = to.matched.some(record => record.meta.requiresGuest);
  const requiresAdmin = to.matched.some(record => record.meta.requiresAdmin);

  if (requiresAuth && !authStore.isAuthenticated) {
    // Redirect to login if authentication required but user not authenticated
    next('/login');
  } else if (requiresGuest && authStore.isAuthenticated) {
    // Redirect to home if guest route but user is authenticated
    next('/');
  } else if (requiresAdmin && !authStore.isAdmin) {
    // Redirect to home if admin required but user is not admin
    next('/');
  } else {
    next();
  }
});

export default router;