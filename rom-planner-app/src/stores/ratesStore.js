// src/stores/ratesStore.js
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { httpAPI } from '../services/httpAPI'; // <--- NEW IMPORT

export const useRatesStore = defineStore('rates', () => {
  const ratesList = ref([]);
  const isLoading = ref(false);
  const error = ref(null);

  async function fetchRates() {
    // REMOVE check for window.electronAPI and mock data
    isLoading.value = true;
    error.value = null;
    try {
      const fetchedRates = await httpAPI.getRates(); // <--- CHANGE HERE
      ratesList.value = fetchedRates;
    } catch (e) {
      console.error('Failed to fetch rates:', e);
      error.value = e.message || 'Failed to fetch rates.';
      ratesList.value = []; // Clear data on error
    } finally {
      isLoading.value = false;
    }
  }

  async function saveRate(rateData) {
    // REMOVE check for window.electronAPI
    isLoading.value = true;
    error.value = null;
    try {
      const savedRate = await httpAPI.saveRate(rateData); // <--- CHANGE HERE
      // Optimistically update or re-fetch for simplicity
      // A full re-fetch is safer for now if backend's upsert logic means ID might not always be 'new' or predictable
      await fetchRates();
      return savedRate;
    } catch (e) {
      console.error('Failed to save rate:', e);
      error.value = e.message || 'Failed to save rate.';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteRate(rateId) {
    // REMOVE check for window.electronAPI
    isLoading.value = true;
    error.value = null;
    try {
      const result = await httpAPI.deleteRate(rateId); // <--- CHANGE HERE
      if (result.success) {
        ratesList.value = ratesList.value.filter(r => r.id !== rateId);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to delete rate:', e);
      error.value = e.message || 'Failed to delete rate.';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  return { ratesList, isLoading, error, fetchRates, saveRate, deleteRate };
});