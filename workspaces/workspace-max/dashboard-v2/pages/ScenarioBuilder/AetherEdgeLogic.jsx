import React from 'react';
import { FiChevronDown, FiDatabase, FiZap, FiX } from 'react-icons/fi';

const AetherEdgeLogic = ({
  conditions,
  onAddRule,
  onRemoveRule,
  onUpdateRule,
  onClose,
  style,
}) => {
  return (
    <div className="aether-logic-wrapper" style={style}>
      <div className="aether-condition-panel">
        <div className="aether-panel-header">
          <span className="condition-label">
            <FiZap size={14} /> Condition
          </span>
          <button type="button" className="aether-close" onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>

        <div className="condition-group">
          <div className="rule-stack">
            {conditions.map((rule) => (
              <div className="rule-card" key={rule.id}>
                <div className="input-container">
                  <div className="variable-input">
                    <FiDatabase size={12} className="variable-icon" />
                    <input
                      className="input-field"
                      value={rule.variable}
                      onChange={(event) => onUpdateRule(rule.id, 'variable', event.target.value)}
                      placeholder="Map variable..."
                    />
                  </div>
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => onRemoveRule(rule.id)}
                  >
                    <FiX size={16} />
                  </button>
                </div>

                <div className="select-wrapper">
                  <select
                    className="select-field"
                    value={rule.operator}
                    onChange={(event) => onUpdateRule(rule.id, 'operator', event.target.value)}
                  >
                    <option value="text_equal">Text operators: Equal to</option>
                    <option value="text_contains">Text operators: Contains</option>
                    <option value="exists">Exists</option>
                  </select>
                  <FiChevronDown size={16} className="select-icon" />
                </div>

                <input
                  className="input-field"
                  value={rule.value}
                  onChange={(event) => onUpdateRule(rule.id, 'value', event.target.value)}
                  placeholder="Value"
                />
              </div>
            ))}
          </div>

          <div className="action-links">
            <button type="button" className="action-link" onClick={onAddRule}>
              + Add AND rule
            </button>
            <button type="button" className="action-link" onClick={onAddRule}>
              + Add OR rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AetherEdgeLogic;
