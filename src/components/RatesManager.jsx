import React, { useState } from 'react';
import './RatesManager.css';

function RatesManager({ rates, onUpdateRate }) {
  const [editingRateId, setEditingRateId] = useState(null);
  const [newDailyRate, setNewDailyRate] = useState('');

  const handleEditClick = (rate) => {
    setEditingRateId(rate.id);
    setNewDailyRate(rate.daily_rate);
  };

  const handleSaveClick = async (rateId) => {
    if (newDailyRate === '' || isNaN(newDailyRate) || parseFloat(newDailyRate) < 0) {
      alert('Please enter a valid positive number for the daily rate.');
      return;
    }
    await onUpdateRate(rateId, parseFloat(newDailyRate));
    setEditingRateId(null);
    setNewDailyRate('');
  };

  const handleCancelClick = () => {
    setEditingRateId(null);
    setNewDailyRate('');
  };

  return (
    <div className="rates-manager">
      <h3>Daily Rates per Role</h3>
      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Daily Rate ($)</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rates.map((rate) => (
            <tr key={rate.id}>
              <td>{rate.role}</td>
              <td>
                {editingRateId === rate.id ? (
                  <input
                    type="number"
                    value={newDailyRate}
                    onChange={(e) => setNewDailyRate(e.target.value)}
                  />
                ) : (
                  `$${rate.daily_rate.toFixed(2)}`
                )}
              </td>
              <td>
                {editingRateId === rate.id ? (
                  <>
                    <button onClick={() => handleSaveClick(rate.id)}>Save</button>
                    <button onClick={handleCancelClick}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => handleEditClick(rate)}>Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default RatesManager;