// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/authStore';

// Import your components
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import RatesManager from '../components/RatesManager.vue';
import GlobalMaterialManager from '../components/GlobalMaterialManager.vue';
import ProjectView from '../views/ProjectView.vue'; // NEW IMPORT
import AdminDashboard from '../views/AdminDashboard.vue'; // NEW IMPORT

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
    component: () => import('../views/Home.vue'), // Assuming Home.vue is a simple welcome page
    meta: { requiresAuth: true }
  },
  {
    path: '/project/new',
    name: 'NewProject',
    components: {
      mainContent: ProjectView // Use ProjectView for new project creation
    },
    meta: { requiresAuth: true },
    props: {
      mainContent: { isNewProject: true } // Pass a prop to indicate new project
    }
  },
  {
    path: '/project/:projectId',
    name: 'ProjectDetails',
    components: {
      mainContent: ProjectView // Use ProjectView for existing project details
    },
    props: {
      mainContent: true // Pass route params as props to ProjectView
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
    components: {
      mainContent: AdminDashboard // Use AdminDashboard for admin panel
    },
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