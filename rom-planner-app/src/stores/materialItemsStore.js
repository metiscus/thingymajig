// src/stores/materialItemsStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { httpAPI } from '../services/httpAPI'; // <--- NEW IMPORT

export const useMaterialItemsStore = defineStore('materialItems', () => {
  const materialItemsList = ref([]);
  const globalMaterialList = ref([]);
  const isLoading = ref(false);
  const error = ref(null);

  async function fetchMaterialItemsForProject(projectId) {
    // REMOVE check for window.electronAPI
    if (!projectId) {
      materialItemsList.value = [];
      return;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const items = await httpAPI.getMaterialItemsForProject(projectId); // <--- CHANGE HERE
      materialItemsList.value = items;
    } catch (e) {
      console.error('Failed to fetch material items:', e);
      error.value = e.message || 'Failed to fetch material items.';
      materialItemsList.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchGlobalMaterials() {
    // REMOVE check for window.electronAPI
    try {
      const items = await httpAPI.getGlobalMaterials(); // <--- CHANGE HERE
      globalMaterialList.value = items;
    } catch (e) {
      console.error('Failed to fetch global materials:', e);
      globalMaterialList.value = [];
    }
  }

  async function saveMaterialItem(itemData) {
    // REMOVE check for window.electronAPI
    isLoading.value = true;
    error.value = null;
    try {
      const savedItem = await httpAPI.saveMaterialItem(itemData); // <--- CHANGE HERE
      if (savedItem && itemData.projectId) {
        await fetchMaterialItemsForProject(itemData.projectId);
      }
      return savedItem;
    } catch (e) {
      console.error('Failed to save material item:', e);
      error.value = e.message || 'Failed to save material item.';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteMaterialItem(itemId, projectId) {
    // REMOVE check for window.electronAPI
    isLoading.value = true;
    error.value = null;
    try {
      const result = await httpAPI.deleteMaterialItem(itemId); // <--- CHANGE HERE
      if (result.success && projectId) {
        await fetchMaterialItemsForProject(projectId);
      }
      return result.success;
    } catch (e) {
      console.error('Failed to delete material item:', e);
      error.value = e.message || 'Failed to delete material item.';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function saveGlobalMaterial(materialData) {
    // REMOVE check for window.electronAPI
    try {
      const saved = await httpAPI.saveGlobalMaterial(materialData); // <--- CHANGE HERE
      await fetchGlobalMaterials();
      return saved;
    } catch (e) {
      console.error('Failed to save global material:', e);
      return null;
    }
  }

  async function deleteGlobalMaterial(materialId) {
    // REMOVE check for window.electronAPI
    try {
      const result = await httpAPI.deleteGlobalMaterial(materialId); // <--- CHANGE HERE
      if (result.success) {
        await fetchGlobalMaterials();
      }
      return result.success;
    } catch (e) {
      console.error('Failed to delete global material:', e);
      return false;
    }
  }

  const totalDetailedMaterialCost = computed(() => {
    return materialItemsList.value.reduce((total, item) => {
      return total + (Number(item.unitPrice || 0) * Number(item.quantity || 0));
    }, 0);
  });

  return {
    materialItemsList,
    globalMaterialList,
    isLoading,
    error,
    fetchMaterialItemsForProject,
    fetchGlobalMaterials,
    saveMaterialItem,
    deleteMaterialItem,
    saveGlobalMaterial,
    deleteGlobalMaterial,
    totalDetailedMaterialCost,
  };
});