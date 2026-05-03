/**
 * FlowExecutor — Walks a scenario's node graph from trigger to end
 *
 * Handles:
 * - Sequential node execution
 * - Condition edge evaluation and branching
 * - Async action pause/resume (e.g., Call Customer)
 * - Flow context passing between nodes
 * - Variable validation gates
 */

const { evaluateConditions } = require('./ConditionEvaluator');
const { ActionExecutor } = require('./ActionExecutor');

class FlowExecutor {
  constructor(deps) {
    this.sbQuery = deps.sbQuery;
    this.broadcast = deps.broadcast;
    this.onPause = deps.onPause;

    this.actionExecutor = new ActionExecutor({
      sbQuery: deps.sbQuery,
      broadcast: deps.broadcast,
      getFlowContext: () => this.flowContext,
    });
  }

  async start(scenario, triggerEvent, flowContext = {}) {
    const nodes = typeof scenario.nodes_data === 'string'
      ? JSON.parse(scenario.nodes_data)
      : scenario.nodes_data;
    const edges = typeof scenario.edges_data === 'string'
      ? JSON.parse(scenario.edges_data)
      : scenario.edges_data;

    if (!nodes || nodes.length === 0) {
      console.error('[FlowExecutor] Scenario has no nodes');
      return { success: false, error: 'No nodes' };
    }

    const nodeMap = {};
    for (const node of nodes) nodeMap[node.id] = node;

    const edgeMap = {};
    for (const edge of edges) {
      if (!edgeMap[edge.from]) edgeMap[edge.from] = [];
      edgeMap[edge.from].push(edge);
    }

    const triggerNode = nodes.find(n => n.configured && n.categoryType === 'TRIGGERS')
      || nodes.find(n => n.configured);

    if (!triggerNode) {
      console.error('[FlowExecutor] No configured trigger node found');
      return { success: false, error: 'No trigger node' };
    }

    const context = {
      ...flowContext,
      _scenarioId: scenario.id,
      _scenarioName: scenario.name,
      _triggerEvent: triggerEvent,
      _scenario: scenario,
      trigger: {
        type: triggerNode.subOptionKey || triggerNode.actionConfig?._key || triggerNode.label,
        label: triggerNode.label,
        ...triggerEvent,
      },
    };

    let executionId = null;
    try {
      const exec = await this.sbQuery('flow_executions', 'POST', {
        scenario_id: scenario.id,
        status: 'running',
        current_node_id: triggerNode.id,
        flow_context: JSON.stringify(context),
        trigger_event: JSON.stringify(triggerEvent),
        started_at: new Date().toISOString(),
      });
      executionId = exec?.[0]?.id;
    } catch (err) {
      console.error('[FlowExecutor] Failed to create execution record:', err.message);
    }

    context._executionId = executionId;
    console.log(`[FlowExecutor] Starting flow: ${scenario.name} from trigger: ${triggerNode.label}`);
    return this._executeFromNode(triggerNode.id, nodes, nodeMap, edgeMap, context, executionId, scenario);
  }

  async resume(executionId, resumeData = {}) {
    try {
      const records = await this.sbQuery('flow_executions', 'GET', null, `?id=eq.${executionId}&limit=1`);
      const execution = records?.[0];
      if (!execution) return { success: false, error: `Execution ${executionId} not found` };
      if (execution.status !== 'paused') return { success: false, error: `Execution is ${execution.status}, not paused` };

      const context = typeof execution.flow_context === 'string'
        ? JSON.parse(execution.flow_context)
        : execution.flow_context;

      if (resumeData.agent) {
        context.agent = { ...(context.agent || {}), ...resumeData.agent };
      }
      Object.assign(context, resumeData);

      await this.sbQuery('flow_executions', 'PATCH', {
        status: 'running',
        flow_context: JSON.stringify(context),
        updated_at: new Date().toISOString(),
      }, `?id=eq.${executionId}`);

      const scenarioRecords = await this.sbQuery('scenarios', 'GET', null, `?id=eq.${execution.scenario_id}&limit=1`);
      const scenario = scenarioRecords?.[0];
      if (!scenario) return { success: false, error: 'Scenario not found' };

      const nodes = typeof scenario.nodes_data === 'string' ? JSON.parse(scenario.nodes_data) : scenario.nodes_data;
      const edges = typeof scenario.edges_data === 'string' ? JSON.parse(scenario.edges_data) : scenario.edges_data;

      const nodeMap = {};
      for (const node of nodes) nodeMap[node.id] = node;

      const edgeMap = {};
      for (const edge of edges) {
        if (!edgeMap[edge.from]) edgeMap[edge.from] = [];
        edgeMap[edge.from].push(edge);
      }

      console.log(`[FlowExecutor] Resuming execution ${executionId} from node: ${execution.current_node_id}`);
      return this._executeFromNode(execution.current_node_id, nodes, nodeMap, edgeMap, context, executionId, scenario);
    } catch (err) {
      console.error('[FlowExecutor] Resume failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  async _executeFromNode(startNodeId, nodes, nodeMap, edgeMap, context, executionId, scenario) {
    let currentNodeId = startNodeId;
    let steps = 0;
    const maxSteps = 100;

    while (currentNodeId && steps < maxSteps) {
      steps++;
      const node = nodeMap[currentNodeId];
      if (!node) {
        console.error(`[FlowExecutor] Node ${currentNodeId} not found`);
        break;
      }

      console.log(`[FlowExecutor] Step ${steps}: ${node.label || currentNodeId} (type: ${node.type})`);

      // Trigger nodes — just follow edges
      if (node.categoryType === 'TRIGGERS' && !node.actionConfig?._key) {
        currentNodeId = this._getNextNode(currentNodeId, edgeMap, context, nodeMap);
        continue;
      }

      const result = await this.actionExecutor.execute(node, context);

      if (!result.success) {
        console.error(`[FlowExecutor] Action failed at ${node.label}:`, result.error);
        await this._updateExecution(executionId, 'failed', currentNodeId, context, result.error);
        return { success: false, error: result.error, failed_at: currentNodeId };
      }

      if (result.data) {
        // Store action result keyed by node ID for variable access: {{nodeId.field}}
        context[node.id] = result.data;
      }

      if (result.pause) {
        console.log(`[FlowExecutor] Flow paused at ${node.label} (execution: ${executionId})`);
        await this._updateExecution(executionId, 'paused', currentNodeId, context, null, result.data);
        if (this.onPause) this.onPause(executionId, node, context, result.data);
        return { success: true, paused: true, executionId, at_node: currentNodeId };
      }

      currentNodeId = this._getNextNode(currentNodeId, edgeMap, context, nodeMap);
    }

    if (steps >= maxSteps) {
      console.error('[FlowExecutor] Max steps reached');
      await this._updateExecution(executionId, 'failed', currentNodeId, context, 'Max steps exceeded');
      return { success: false, error: 'Max steps exceeded' };
    }

    console.log(`[FlowExecutor] Flow completed: ${scenario.name}`);
    await this._updateExecution(executionId, 'completed', null, context);
    return { success: true, completed: true, context };
  }

  _getNextNode(fromNodeId, edgeMap, context, nodeMap) {
    const edges = edgeMap[fromNodeId];
    if (!edges || edges.length === 0) return null;

    if (edges.length === 1) {
      const edge = edges[0];
      if (edge.filter?.rules?.length > 0) {
        const passes = evaluateConditions(edge.filter.rules, context);
        if (!passes) {
          console.log(`[FlowExecutor] Condition failed on edge ${edge.id}`);
          return null;
        }
      }
      return edge.to;
    }

    for (const edge of edges) {
      if (!edge.filter?.rules || edge.filter.rules.length === 0) continue;
      const passes = evaluateConditions(edge.filter.rules, context);
      if (passes) {
        console.log(`[FlowExecutor] Condition matched on edge ${edge.id}`);
        return edge.to;
      }
    }

    const fallback = edges.find(e => !e.filter?.rules || e.filter.rules.length === 0);
    if (fallback) return fallback.to;

    console.log(`[FlowExecutor] No matching condition from ${fromNodeId} — flow ends`);
    return null;
  }

  async _updateExecution(executionId, status, currentNodeId, context, error = null, pauseData = null) {
    if (!executionId) return;
    try {
      const update = {
        status,
        current_node_id: currentNodeId,
        flow_context: JSON.stringify(context),
        updated_at: new Date().toISOString(),
      };
      if (error) update.error = error;
      if (pauseData) update.pause_data = JSON.stringify(pauseData);
      if (status === 'completed') update.completed_at = new Date().toISOString();
      if (status === 'failed') update.failed_at = new Date().toISOString();
      await this.sbQuery('flow_executions', 'PATCH', update, `?id=eq.${executionId}`);
    } catch (err) {
      console.error('[FlowExecutor] Failed to update execution:', err.message);
    }
  }
}

module.exports = { FlowExecutor };
