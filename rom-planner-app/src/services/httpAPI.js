// src/services/httpAPI.js
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// NEW: Axios interceptor to add JWT to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    // Make sure we're using the correct Bearer format
    config.headers.Authorization = `Bearer ${token}`;
    console.log('Request with token:', config.headers.Authorization.substring(0, 30) + '...');
  }
  return config;
}, error => {
  return Promise.reject(error);
});

// Response interceptor for 401 handling
api.interceptors.response.use(response => response, error => {
  if (error.response && error.response.status === 401) {
    console.warn('Unauthorized request. Token might be expired or invalid.');
    // Clear the invalid token
    localStorage.removeItem('jwt_token');
  }
  return Promise.reject(error);
});


export const httpAPI = {
  // --- AUTHENTICATION ---
  login: async (email, password) => {
    // fastapi-users /auth/jwt/login endpoint expects a POST with form data
    const formData = new URLSearchParams();
    formData.append('username', email); // fastapi-users uses 'username' for email by default
    formData.append('password', password);
    try {
      const response = await api.post('/auth/jwt/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      console.log('Login response:', response.data);

      return response.data; // Should contain 'access_token' and 'token_type'
    } catch (error) {
      console.error('httpAPI: Login error:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  register: async (email, password) => {
    try {
      const response = await api.post('/auth/register', { email, password });
      return response.data; // Should contain new user data
    } catch (error) {
      console.error('httpAPI: Registration error:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  logout: async () => {
    // fastapi-users /auth/jwt/logout endpoint (typically a POST with no body)
    try {
      await api.post('/auth/jwt/logout');
      return true;
    } catch (error) {
      console.error('httpAPI: Logout error:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  getCurrentUser: async () => {
    // fastapi-users /users/me endpoint
    try {
      const response = await api.get('/users/me');
      return response.data; // Returns UserRead schema
    } catch (error) {
      console.error('httpAPI: Get current user error:', error.response?.data || error.message);
      throw error.response?.data || error;
    }
  },
  // --- Projects ---
  getProjects: async () => {
    try {
      const response = await api.get('/projects');
      return response.data;
    } catch (error) {
      console.error('httpAPI: Error fetching projects:', error);
      throw error;
    }
  },
  saveProject: async (projectData) => {
    try {
      if (projectData.id) {
        // Update existing project
        const response = await api.put(`/projects/${projectData.id}`, projectData);
        return response.data;
      } else {
        // Create new project
        const response = await api.post('/projects/', projectData);
        return response.data;
      }
    } catch (error) {
      console.error('httpAPI: Error saving project:', error);
      throw error;
    }
  },
  deleteProject: async (projectId) => {
    try {
      const response = await api.delete(`/projects/${projectId}`);
      // FastAPI returns 204 No Content for successful deletion.
      // Axios resolves with response.status 204, data is empty.
      // We return a success flag consistent with previous electronAPI.
      return { success: response.status === 204, id: projectId };
    } catch (error) {
      console.error('httpAPI: Error deleting project:', error);
      throw error;
    }
  },
  exportProjectToExcel: async (projectId) => {
    try {
      // Use responseType 'blob' to handle binary data (the Excel file)
      const response = await api.get(`/export/project/${projectId}/excel`, { responseType: 'blob' });

      // Create a URL for the blob and trigger a download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      // You might parse the filename from the Content-Disposition header if available
      // Example: const filename = response.headers['content-disposition'].split('filename=')[1];
      link.setAttribute('download', `Project_Export_${projectId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return { success: true, filePath: 'Downloaded to default location' }; // Mimic Electron result
    } catch (error) {
      console.error('httpAPI: Error exporting project to Excel:', error);
      // More detailed error handling for the user might be needed based on HTTP status code
      return { success: false, error: error.response?.data?.detail || error.message };
    }
  },

  // --- Tasks ---
  getTasksForProject: async (projectId) => {
    try {
      const response = await api.get(`/tasks/?project_id=${projectId}`);
      return response.data;
    } catch (error) {
      console.error(`httpAPI: Error fetching tasks for project ${projectId}:`, error);
      throw error;
    }
  },
  saveTask: async (taskData) => {
    try {
      if (taskData.id) {
        const response = await api.put(`/tasks/${taskData.id}`, taskData);
        return response.data;
      } else {
        const response = await api.post('/tasks/', taskData);
        return response.data;
      }
    } catch (error) {
      console.error('httpAPI: Error saving task:', error);
      throw error;
    }
  },
  deleteTask: async (taskId) => {
    try {
      const response = await api.delete(`/tasks/${taskId}`);
      return { success: response.status === 204, id: taskId };
    } catch (error) {
      console.error('httpAPI: Error deleting task:', error);
      throw error;
    }
  },
  updateTaskSequence: async (tasksToUpdate) => {
    try {
      // Wrap the array in the expected format
      const requestData = { tasks: tasksToUpdate };
      console.log('Sending task sequence update:', requestData);
      const response = await api.put('/tasks/sequence', requestData);
      return response.data;
    } catch (error) {
      console.error('httpAPI: Error updating task sequence:', error);
      // ADD THIS LINE TO LOG THE DETAILED ERROR FROM FASTAPI:
      if (error.response && error.response.data) {
        console.error('Error details from FastAPI:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  },

  // --- Material Items ---
  getMaterialItemsForProject: async (projectId) => {
    try {
      const response = await api.get(`/material_items/?project_id=${projectId}`);
      return response.data;
    } catch (error) {
      console.error(`httpAPI: Error fetching material items for project ${projectId}:`, error);
      throw error;
    }
  },
  saveMaterialItem: async (itemData) => {
    try {
      if (itemData.id) {
        const response = await api.put(`/material_items/${itemData.id}`, itemData);
        return response.data;
      } else {
        const response = await api.post('/material_items/', itemData);
        return response.data;
      }
    } catch (error) {
      console.error('httpAPI: Error saving material item:', error);
      throw error;
    }
  },
  deleteMaterialItem: async (itemId) => {
    try {
      const response = await api.delete(`/material_items/${itemId}`);
      return { success: response.status === 204, id: itemId };
    } catch (error) {
      console.error('httpAPI: Error deleting material item:', error);
      throw error;
    }
  },

  // --- Global Materials ---
  getGlobalMaterials: async () => {
    try {
      const response = await api.get('/global_materials');
      return response.data;
    } catch (error) {
      console.error('httpAPI: Error fetching global materials:', error);
      throw error;
    }
  },
  saveGlobalMaterial: async (materialData) => {
    try {
      if (materialData.id) {
        const response = await api.put(`/global_materials/${materialData.id}`, materialData);
        return response.data;
      } else {
        const response = await api.post('/global_materials/', materialData);
        return response.data;
      }
    } catch (error) {
      console.error('httpAPI: Error saving global material:', error);
      throw error;
    }
  },
  deleteGlobalMaterial: async (materialId) => {
    try {
      const response = await api.delete(`/global_materials/${materialId}`);
      return { success: response.status === 204, id: materialId };
    } catch (error) {
      console.error('httpAPI: Error deleting global material:', error);
      throw error;
    }
  },

  // --- Rates ---
  getRates: async () => {
    try {
      const response = await api.get('/rates');
      return response.data;
    } catch (error) {
      console.error('httpAPI: Error fetching rates:', error);
      throw error;
    }
  },
  saveRate: async (rateData) => {
    try {
      if (rateData.id) {
        const response = await api.put(`/rates/${rateData.id}`, rateData);
        return response.data;
      } else {
        const response = await api.post('/rates/', rateData);
        return response.data;
      }
    } catch (error) {
      console.error('httpAPI: Error saving rate:', error);
      throw error;
    }
  },
  deleteRate: async (rateId) => {
    try {
      const response = await api.delete(`/rates/${rateId}`);
      return { success: response.status === 204, id: rateId };
    } catch (error) {
      console.error('httpAPI: Error deleting rate:', error);
      throw error;
    }
  },
};