// src/stores/materialItemsStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useMaterialItemsStore = defineStore('materialItems', () => {
  const materialItemsList = ref([]); // For the currently selected project
  const globalMaterialList = ref([]); // New: For globally stored materials
  const isLoading = ref(false);
  const error = ref(null);

  async function fetchMaterialItemsForProject(projectId) {
    if (!window.electronAPI || !projectId) {
      materialItemsList.value = [];
      return;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const items = await window.electronAPI.getMaterialItemsForProject(projectId);
      materialItemsList.value = items;
    } catch (e) {
      console.error('Failed to fetch material items:', e);
      error.value = e.message || 'Failed to fetch material items.';
      materialItemsList.value = [];
    } finally {
      isLoading.value = false;
    }
  }

  // New: Fetch global materials
  async function fetchGlobalMaterials() {
    if (!window.electronAPI) {
      console.warn('Electron API not available. Cannot fetch global materials.');
      globalMaterialList.value = [];
      return;
    }
    try {
      const items = await window.electronAPI.getGlobalMaterials();
      globalMaterialList.value = items;
    } catch (e) {
      console.error('Failed to fetch global materials:', e);
      globalMaterialList.value = [];
    }
  }

  async function saveMaterialItem(itemData) { // { id?, projectId, lineItem, vendor, category, unitPrice, quantity, comment }
    if (!window.electronAPI) {
      error.value = 'Electron API not available.';
      return null;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const savedItem = await window.electronAPI.saveMaterialItem(itemData);
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
    if (!window.electronAPI) {
      error.value = 'Electron API not available.';
      return false;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const result = await window.electronAPI.deleteMaterialItem(itemId);
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

  // New: Save global material (e.g., from a separate management view)
  async function saveGlobalMaterial(materialData) {
    if (!window.electronAPI) return null;
    try {
      const saved = await window.electronAPI.saveGlobalMaterial(materialData);
      await fetchGlobalMaterials(); // Refresh global list after save
      return saved;
    } catch (e) {
      console.error('Failed to save global material:', e);
      return null;
    }
  }

  // New: Delete global material
  async function deleteGlobalMaterial(materialId) {
    if (!window.electronAPI) return false;
    try {
      const result = await window.electronAPI.deleteGlobalMaterial(materialId);
      if (result.success) {
        await fetchGlobalMaterials(); // Refresh global list
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