# Yanna Independent Agent Setup Plan

## Current Issue
Yanna is currently a subagent of Max. When spawned as a subagent, she experiences workspace isolation issues:
- Subagent doesn't properly load her own SOUL.md, IDENTITY.md, AGENTS.md from workspace-yanna
- Subagent appears to inherit parent session context instead

## The "Awake" Concern

**Question:** If Yanna is an independent agent, will she be awake for Max to ping her?

**Answer:** This depends on how OpenClaw handles independent agents vs subagents.

### Subagent Behavior (Current)
- ❌ Spawns on-demand when called
- ❌ Workspace isolation issues
- ✅ Automatically responds when spawned

### Independent Agent Behavior (Proposed)
- ✅ Proper workspace loading (no isolation issues)
- ⚠️ Needs to be "running" to receive messages
- ❓ May not auto-respond if not active

## The Links' Relevance

The links Keagan sent were about **orchestration patterns** for multi-agent systems:
1. rustyorb — Optimization (not relevant)
2. moltenbot000 — Orchestration patterns (useful for understanding how to structure agent communication)
3. phenomenoner — Agent optimization (not relevant)

**None directly solve the "awake" problem** because that's a platform/runtime issue, not an orchestration pattern issue.

## Solutions for the "Awake" Problem

### Option 1: Keep Subagent but Fix Workspace Isolation
**Requires:** Changes to OpenClaw spawn protocol
- Ensure `cwd` parameter properly isolates file loading
- Don't inherit parent session context
**Pros:** Automatic "awake" behavior
**Cons:** Requires platform-level changes

### Option 2: Independent Agent with Heartbeat
**Requires:** Set up Yanna as persistent agent with heartbeat
- Yanna maintains a persistent session (like Max)
- Heartbeat keeps her active
- Max can send messages via `sessions_send`
**Pros:** Proper workspace loading, reliable messaging
**Cons:** Requires additional configuration

### Option 3: Hybrid Approach
**Requires:** Webhook-based activation
- Yanna stays dormant but has webhook endpoint
- Max triggers Yanna via webhook when needed
- Yanna spawns, does work, then goes dormant
**Pros:** Only active when needed, saves resources
**Cons:** More complex setup

## Recommendation

**Option 2: Independent Agent with Heartbeat**

This is the most reliable because:
1. ✅ Proper workspace loading (no isolation issues)
2. ✅ Can be pinged by Max via `sessions_send`
3. ✅ Can maintain state between tasks
4. ✅ Follows same pattern as Max (proven working)

**Implementation Steps:**
1. Set up Yanna as independent agent in OpenClaw
2. Configure heartbeat to keep her session active
3. Update Max's dispatch protocol to use `sessions_send` instead of `sessions_spawn`
4. Test that Yanna receives and responds to messages

**Concern about "awake":**
If Yanna is an independent agent with a persistent session, she will be "awake" and able to receive messages from Max, similar to how Max can receive messages from Keagan.
