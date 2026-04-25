/**
 * ConditionEvaluator — Evaluates rule sets from condition edges
 *
 * Supports: AND/OR logic, multiple operators, null checks
 * Reads variables from flow context (agent data, lead fields, business data)
 */

const OPERATORS = {
  equals: (a, b) => a === b,
  not_equals: (a, b) => a !== b,
  contains: (a, b) => typeof a === 'string' && a.toLowerCase().includes(String(b).toLowerCase()),
  not_contains: (a, b) => !(typeof a === 'string' && a.toLowerCase().includes(String(b).toLowerCase())),
  is_empty: (a) => a == null || a === '',
  is_not_empty: (a) => a != null && a !== '',
  greater_than: (a, b) => Number(a) > Number(b),
  less_than: (a, b) => Number(a) < Number(b),
  before: (a, b) => new Date(a) < new Date(b),
  after: (a, b) => new Date(a) > new Date(b),
  includes: (a, b) => Array.isArray(a) && a.includes(b),
  does_not_include: (a, b) => Array.isArray(a) && !a.includes(b),
};

/**
 * Resolve a variable reference from flow context.
 * Supports dot notation: "agent.email", "lead.status", "business.name"
 */
function resolveVariable(key, context) {
  if (!key || !context) return null;
  const parts = key.split('.');
  let value = context;
  for (const part of parts) {
    if (value == null) return null;
    value = value[part];
  }
  return value ?? null;
}

/**
 * Evaluate a single rule against the context.
 * Returns true/false.
 */
function evaluateRule(rule, context) {
  const value = resolveVariable(rule.variable, context);
  const op = OPERATORS[rule.operator];

  if (!op) {
    console.warn(`[ConditionEvaluator] Unknown operator: ${rule.operator}`);
    return false;
  }

  // Null-check operators
  if (rule.operator === 'is_empty') return op(value);
  if (rule.operator === 'is_not_empty') return op(value);

  // Comparison operators need a value
  if (value == null && rule.value == null) return rule.operator === 'equals';

  return op(value, rule.value);
}

/**
 * Evaluate a set of rules with AND/OR logic.
 *
 * Rules array format:
 * [
 *   { id: 1, variable: "agent.outcome", operator: "equals", value: "completed", logic: "and" },
 *   { id: 2, variable: "lead.status", operator: "not_equals", value: "do_not_call", logic: "and" },
 *   { id: 3, variable: "agent.email", operator: "is_not_empty", value: "", logic: "and" }
 * ]
 *
 * The first rule's `logic` field is ignored (it's the starting point).
 * Subsequent rules use their `logic` to chain: "and" = all must pass, "or" = any passes.
 */
function evaluateConditions(rules, context) {
  if (!rules || rules.length === 0) return true;

  let result = evaluateRule(rules[0], context);

  for (let i = 1; i < rules.length; i++) {
    const ruleResult = evaluateRule(rules[i], context);
    if (rules[i].logic === 'or') {
      result = result || ruleResult;
    } else {
      result = result && ruleResult;
    }
  }

  return result;
}

module.exports = { evaluateConditions, evaluateRule, resolveVariable };
