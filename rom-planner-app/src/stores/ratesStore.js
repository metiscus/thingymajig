// src/stores/ratesStore.js
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useRatesStore = defineStore('rates', () => {
  const ratesList = ref([]); // Holds the list of rate objects {id, role, rate, unit}
  const isLoading = ref(false);
  const error = ref(null);

  async function fetchRates() {
    if (!window.electronAPI) {
      console.error('electronAPI is not available. Running in browser without Electron context?');
      error.value = 'Electron API not available. Cannot fetch rates.';
      ratesList.value = [ // Mock data for browser testing
        { id: 1, role: 'Engineer (Browser Mock)', rate: 100, unit: 'hour' },
        { id: 2, role: 'Designer (Browser Mock)', rate: 800, unit: 'day' },
      ];
      return;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const fetchedRates = await window.electronAPI.getRates();
      ratesList.value = fetchedRates;
    } catch (e) {
      console.error('Failed to fetch rates:', e);
      error.value = e.message || 'Failed to fetch rates.';
    } finally {
      isLoading.value = false;
    }
  }

  async function saveRate(rateData) { // rateData = { role, rate, unit }
    if (!window.electronAPI) {
      console.error('electronAPI is not available.');
      error.value = 'Electron API not available. Cannot save rate.';
      return null;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const savedRate = await window.electronAPI.saveRate(rateData);
      // Efficiently update or add the rate in the local list
      const index = ratesList.value.findIndex(r => r.role === savedRate.role);
      if (index !== -1) {
        ratesList.value[index] = savedRate;
      } else {
        // If it was a new role, it might not have an ID from the initial fetch
        // or the savedRate might be a completely new record. Re-fetch or smartly add.
        // For simplicity now, we'll just add it if it's truly new by role,
        // or assume the DB handles uniqueness and the returned object is the source of truth.
        // A more robust way if 'id' is always returned and consistent:
        // const existingById = ratesList.value.findIndex(r => r.id === savedRate.id);
        // if (existingById !== -1) ratesList.value[existingById] = savedRate; else ratesList.value.push(savedRate);
        await fetchRates(); // Easiest way to ensure consistency for now
      }
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
    if (!window.electronAPI) {
      console.error('electronAPI is not available.');
      error.value = 'Electron API not available. Cannot delete rate.';
      return false;
    }
    isLoading.value = true;
    error.value = null;
    try {
      const result = await window.electronAPI.deleteRate(rateId);
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