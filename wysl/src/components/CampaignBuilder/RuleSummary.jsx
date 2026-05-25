// src/components/CampaignBuilder/RuleSummary.jsx
import React from 'react';

const RuleSummary = ({ rule }) => {
  if (!rule || rule.conditions.length === 0) {
    return <p className="text-gray-500 text-sm italic">No conditions defined for this rule block.</p>;
  }

  const formatCondition = (condition) => {
    const { table, field, operator, value } = condition;
    if (!table || !field || !operator || value === undefined) return '';

    let formattedValue = value;
    if (typeof value === 'string') {
      formattedValue = `'${value}'`;
    }

    return `${table}.${field} ${operator} ${formattedValue}`;
  };

  const summary = rule.conditions.map(formatCondition).filter(Boolean).join(' AND ');

  return (
    <div className="rule-summary text-sm text-gray-300 mt-2 p-2 bg-gray-900 rounded border border-gray-700">
      Follow up if {summary}.
    </div>
  );
};

export default RuleSummary;
