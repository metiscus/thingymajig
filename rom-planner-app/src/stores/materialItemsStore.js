// src/stores/materialItemsStore.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useMaterialItemsStore = defineStore('materialItems', () => {
  const materialItemsList = ref([]); // For the currently selected project
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
        // Refetch or update list locally
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

  const totalDetailedMaterialCost = computed(() => {
    return materialItemsList.value.reduce((total, item) => {
      return total + (Number(item.unitPrice || 0) * Number(item.quantity || 0));
    }, 0);
  });

  return {
    materialItemsList,
    isLoading,
    error,
    fetchMaterialItemsForProject,
    saveMaterialItem,
    deleteMaterialItem,
    totalDetailedMaterialCost,
  };
});