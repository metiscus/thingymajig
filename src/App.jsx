import React, { useState, useEffect, useCallback } from 'react';
import RatesManager from './components/RatesManager';
import TaskTable from './components/TaskTable';
import Summary from './components/Summary';
import './App.css'; // Main app styling

function App() {
  const [tasks, setTasks] = useState([]);
  const [rates, setRates] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Memoized function to fetch rates
  const fetchRates = useCallback(async () => {
    try {
      const fetchedRates = await window.api.getRates();
      setRates(fetchedRates);
    } catch (err) {
      console.error("Failed to fetch rates:", err);
      setError("Failed to load rates.");
    }
  }, []);

  // Memoized function to fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const fetchedTasks = await window.api.getTasks();
      setTasks(fetchedTasks);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setError("Failed to load tasks.");
    }
  }, []);

  // Memoized function to calculate and fetch totals
  const calculateAllTotals = useCallback(async () => {
    try {
      const calculatedTotals = await window.api.calculateTotals();
      setTotals(calculatedTotals);
    } catch (err) {
      console.error("Failed to calculate totals:", err);
      setError("Failed to calculate totals.");
    }
  }, []);

  // Initial data load on component mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchRates();
      await fetchTasks();
      setLoading(false);
    };
    loadData();
  }, [fetchRates, fetchTasks]); // Dependencies for initial load

  // Recalculate totals whenever tasks or rates change (and initial load is done)
  useEffect(() => {
    if (!loading) {
      calculateAllTotals();
    }
  }, [tasks, rates, loading, calculateAllTotals]);

  // Handlers for data updates
  const handleUpdateRate = async (id, dailyRate) => {
    await window.api.updateRate(id, dailyRate);
    await fetchRates(); // Re-fetch rates to update UI and trigger total recalculation
  };

  const handleAddTask = async (newTaskData) => {
    const addedTask = await window.api.addTask(newTaskData);
    setTasks((prevTasks) => [...prevTasks, addedTask]);
  };

  const handleUpdateTask = async (updatedTaskData) => {
    await window.api.updateTask(updatedTaskData);
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === updatedTaskData.id ? { ...task, ...updatedTaskData, project_name: updatedTaskData.projectName, task: updatedTaskData.taskName } : task
      )
    );
  };

  const handleDeleteTask = async (id) => {
    await window.api.deleteTask(id);
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
  };

  // Handler for Excel Export
  const handleExport = async () => {
    const response = await window.api.exportToExcel();
    if (response.success) {
      alert(response.message);
    } else {
      alert(`Export failed: ${response.message}`);
    }
  };

  if (loading) return <div className="loading">Loading data...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="app-container">
      <h1>Rough Order of Magnitude Planner</h1>

      <div className="rates-section">
        <RatesManager rates={rates} onUpdateRate={handleUpdateRate} />
      </div>

      <div className="planning-section">
        <h2>Project Tasks</h2>
        <TaskTable
          tasks={tasks}
          onAddTask={handleAddTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      </div>

      <div className="summary-section">
        <h2>Summary & Totals</h2>
        {totals && <Summary totals={totals} rates={rates} />}
        <button onClick={handleExport} className="export-button">Export to Excel (XLSX)</button>
      </div>
    </div>
  );
}

export default App;