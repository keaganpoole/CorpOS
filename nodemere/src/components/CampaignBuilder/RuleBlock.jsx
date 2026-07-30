// src/components/CampaignBuilder/RuleBlock.jsx
import React, { useState, useEffect } from 'react';
import FilterBuilder from './FilterBuilder';
import RuleSummary from './RuleSummary';

const RuleBlock = ({ ruleBlock, onRuleBlockChange, onRemoveRuleBlock }) => {
  const [conditions, setConditions] = useState(ruleBlock?.conditions || [{}]);

  useEffect(() => {
    onRuleBlockChange({ id: ruleBlock.id, conditions });
  }, [conditions]);

  const handleConditionChange = (index, newCondition) => {
    const updatedConditions = conditions.map((cond, i) =>
      i === index ? newCondition : cond
    );
    setConditions(updatedConditions);
  };

  const addCondition = () => {
    setConditions([...conditions, {}]);
  };

  const removeCondition = (index) => {
    const updatedConditions = conditions.filter((_, i) => i !== index);
    setConditions(updatedConditions.length > 0 ? updatedConditions : [{}] ); // Ensure at least one condition remains
  };

  return (
    <div className="rule-block border p-4 rounded-lg shadow-sm bg-white mb-4">
      <h3 className="text-lg font-semibold mb-3">Rule Block (AND conditions)</h3>
      {conditions.map((condition, index) => (
        <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 mb-3">
          <FilterBuilder
            condition={condition}
            onConditionChange={(newCond) => handleConditionChange(index, newCond)}
          />
          {conditions.length > 1 && (
            <button
              onClick={() => removeCondition(index)}
              className="text-red-500 hover:text-red-700 text-xl"
              title="Remove condition"
            >
              &times;
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addCondition}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
      >
        Add AND Condition
      </button>
      {onRemoveRuleBlock && (
        <button
          onClick={onRemoveRuleBlock}
          className="ml-2 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
        >
          Remove Rule Block (OR)
        </button>
      )}
      <RuleSummary rule={{ conditions }} />
    </div>
  );
};

export default RuleBlock;
