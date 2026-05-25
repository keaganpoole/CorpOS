// src/components/CampaignBuilder/RuleBlockStack.jsx
import React, { useState, useEffect } from 'react';
import RuleBlock from './RuleBlock';

const RuleBlockStack = ({ rules, onRulesChange }) => {
  const [ruleBlocks, setRuleBlocks] = useState(rules || [{ id: Date.now(), conditions: [{}] }]);

  useEffect(() => {
    onRulesChange(ruleBlocks);
  }, [ruleBlocks]);

  const addRuleBlock = () => {
    setRuleBlocks([...ruleBlocks, { id: Date.now(), conditions: [{}] }]);
  };

  const handleRuleBlockChange = (updatedRuleBlock) => {
    setRuleBlocks(ruleBlocks.map(block => 
      block.id === updatedRuleBlock.id ? updatedRuleBlock : block
    ));
  };

  const removeRuleBlock = (idToRemove) => {
    setRuleBlocks(ruleBlocks.filter(block => block.id !== idToRemove));
  };

  return (
    <div className="rule-block-stack">
      {ruleBlocks.map((ruleBlock, index) => (
        <RuleBlock
          key={ruleBlock.id}
          ruleBlock={ruleBlock}
          onRuleBlockChange={handleRuleBlockChange}
          onRemoveRuleBlock={ruleBlocks.length > 1 ? () => removeRuleBlock(ruleBlock.id) : null}
        />
      ))}
      <button
        onClick={addRuleBlock}
        className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 text-sm mt-4"
      >
        Add OR Rule Block
      </button>
    </div>
  );
};

export default RuleBlockStack;
