/**
 * promptBuilder — Builds the ElevenLabs agent prompt for scenario calls
 *
 * Scans the scenario graph for {{agent.*}} variables that downstream nodes need,
 * then constructs a prompt telling the agent what data to collect.
 * Generates the set_agent_data tool schema with the correct variable names.
 */

/**
 * Scan all nodes after a call node for {{agent.*}} variable references.
 * Returns deduplicated list of variable names.
 *
 * @param {object} scenario - Scenario record from Supabase (nodes_data)
 * @param {string} afterNodeId - The call node ID (only scan nodes after this)
 * @returns {string[]} e.g. ["email", "notes", "preferred_callback_time"]
 */
function extractAgentVariables(scenario, afterNodeId = null) {
  const nodes = typeof scenario.nodes_data === 'string'
    ? JSON.parse(scenario.nodes_data)
    : scenario.nodes_data;
  const edges = typeof scenario.edges_data === 'string'
    ? JSON.parse(scenario.edges_data)
    : scenario.edges_data;

  if (!nodes || !edges) return [];

  // If afterNodeId provided, find all nodes reachable from it
  let targetNodeIds = null;
  if (afterNodeId) {
    targetNodeIds = new Set();
    const queue = [afterNodeId];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const edge of edges) {
        if (edge.from === current && !targetNodeIds.has(edge.to)) {
          targetNodeIds.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
  }

  const vars = new Set();
  const textFields = [
    'actionConfig', 'appointmentConfig', 'scheduleConfig',
    'detail', 'label', 'notes',
  ];

  for (const node of nodes) {
    // Skip nodes before the call node
    if (targetNodeIds && !targetNodeIds.has(node.id)) continue;

    // Check all config objects for {{agent.*}} references
    for (const field of textFields) {
      const config = node[field];
      if (!config) continue;

      if (typeof config === 'string') {
        extractVarsFromString(config, vars);
      } else if (typeof config === 'object') {
        for (const val of Object.values(config)) {
          if (typeof val === 'string') {
            extractVarsFromString(val, vars);
          }
        }
      }
    }
  }

  return [...vars];
}

function extractVarsFromString(str, varsSet) {
  const matches = str.matchAll(/\{\{agent\.([^}]+)\}\}/g);
  for (const m of matches) {
    varsSet.add(m[1].trim());
  }
}

/**
 * Find the first call node in a scenario
 * @returns {string|null} The node ID
 */
function findCallNodeId(scenario) {
  const nodes = typeof scenario.nodes_data === 'string'
    ? JSON.parse(scenario.nodes_data)
    : scenario.nodes_data;

  if (!nodes) return null;

  const callNode = nodes.find(n =>
    n.subOptionKey === 'call_customer' ||
    n.actionConfig?._key === 'call_customer' ||
    n.label?.toLowerCase().includes('call customer')
  );

  return callNode?.id || null;
}

/**
 * Build the agent system prompt for a scenario call.
 *
 * @param {object} params
 * @param {object} params.scenario - Scenario record
 * @param {object} params.business - Business record
 * @param {object} params.receptionist - Receptionist record
 * @param {object} params.lead - Lead record (if applicable)
 * @param {object} params.customer - Customer record (if applicable)
 * @param {string} params.basePrompt - The agent's base prompt from ElevenLabs config
 * @returns {{ prompt: string, toolSchema: object }}
 */
function buildAgentPrompt({ scenario, business, receptionist, lead, customer, basePrompt }) {
  const callNodeId = findCallNodeId(scenario);
  const agentVars = extractAgentVariables(scenario, callNodeId);

  let prompt = basePrompt || `You are a professional receptionist for ${business?.name || 'the business'}.`;

  // Add business context
  if (business) {
    prompt += `\n\nBusiness: ${business.name}`;
    if (business.business_hours) prompt += `\nHours: ${business.business_hours}`;
    if (business.phone) prompt += `\nPhone: ${business.phone}`;
  }

  // Add receptionist context
  if (receptionist) {
    prompt += `\n\nYou are ${receptionist.first_name || receptionist.full_name || 'the receptionist'}.`;
    if (receptionist.description) prompt += ` ${receptionist.description}`;
  }

  // Add customer context
  if (customer || lead) {
    const name = customer?.name || lead?.name || '';
    const phone = customer?.phone || lead?.phone || '';
    if (name || phone) {
      prompt += `\n\nYou are speaking with ${name || 'a customer'}`;
      if (phone) prompt += ` (phone: ${phone})`;
      prompt += '.';
    }
  }

  // Add variable capture instructions
  if (agentVars.length > 0) {
    prompt += `\n\n## Data Collection\nDuring this call, collect the following information:\n`;
    for (const v of agentVars) {
      const friendlyName = v.replace(/_/g, ' ');
      prompt += `- ${friendlyName}\n`;
    }
    prompt += `\nUse the "set_agent_data" tool to record each piece of data as you collect it. `;
    prompt += `The key should match the variable name exactly (e.g., "email", "notes").`;
    prompt += `\nWhen you have collected what you can, or when the conversation is ending, make sure all collected data is logged via the tool before saying goodbye.`;
  }

  return {
    prompt,
    toolSchema: agentVars.length > 0 ? buildSetDataTool(agentVars) : null,
  };
}

/**
 * Build the set_agent_data tool schema for the given variables
 */
function buildSetDataTool(variableNames) {
  return {
    name: 'set_agent_data',
    description: 'Record data collected during the call for use in the workflow',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          enum: variableNames,
          description: 'The variable name to record',
        },
        value: {
          type: 'string',
          description: 'The value to record',
        },
      },
      required: ['key', 'value'],
    },
  };
}

module.exports = {
  extractAgentVariables,
  findCallNodeId,
  buildAgentPrompt,
  buildSetDataTool,
};
