import React from 'react';
import './Summary.css';

function Summary({ totals, rates }) {
  // Define the order of roles for consistent display
  const roleOrder = ['Eng', 'Art / Unreal', 'Sys. Eng', 'QA', 'PM', 'Doc'];

  return (
    <div className="summary-section-content">
      <h3>Total Estimated Days & Dollars</h3>
      <div className="summary-grid">
        {roleOrder.map(role => {
            // Find the normalized key used in totals.totalDays (e.g., 'eng', 'art_unreal')
            const roleKey = role.replace(/ /g, '_').replace(/[\W_]+/g, '_').toLowerCase();
            const totalDaysForRole = totals.totalDays[roleKey] || 0;
            const totalDollarsForRole = totals.totalDollars[role] || 0; // Use original role name for totalDollars lookup
            const currentRate = rates.find(r => r.role === role)?.daily_rate || 0;
            
            return (
                <React.Fragment key={role}>
                    <div className="summary-label">{role} (Days):</div>
                    <div className="summary-value">{totalDaysForRole.toFixed(2)}</div>
                    <div className="summary-label">{role} (Dollars):</div>
                    <div className="summary-value">${totalDollarsForRole.toFixed(2)}</div>
                    <div className="summary-label">Current Daily Rate:</div>
                    <div className="summary-value">${currentRate.toFixed(2)}</div>
                </React.Fragment>
            );
        })}
        <div className="summary-label">Total Direct Costs (Travel + Materials):</div>
        <div className="summary-value">${totals.totalDirectCosts.toFixed(2)}</div>
        <div className="summary-label grand-total-label">GRAND TOTAL PROJECT COST:</div>
        <div className="summary-value grand-total-value">${totals.grandTotalDollars.toFixed(2)}</div>
      </div>
    </div>
  );
}

export default Summary;