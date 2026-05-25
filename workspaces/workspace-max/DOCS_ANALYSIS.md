# OpenClaw Docs Analysis: Yanna Independent Agent Setup

## Key Findings from docs.openclaw.ai

### 1. **Multi-Agent Routing** (https://docs.openclaw.ai/concepts/multi-agent)

**What it says about independent agents:**
- An **agent** is a fully scoped brain with its own:
  - Workspace (files, AGENTS.md/SOUL.md/USER.md, local notes, persona rules)
  - State directory (`agentDir`) for auth profiles, model registry, per-agent config
  - Session store under `~/.openclaw/agents/<agentId>/sessions`

**Agent creation:**
```bash
openclaw agents add yanna --workspace ~/.openclaw/workspace-yanna
```

**How agents stay "awake":**
- Each agent has its own **session store** that persists between messages
- The Gateway hosts agents **side-by-side** — they're always available
- No concept of "awake" vs "asleep" — agents are always ready to receive messages

**This directly answers your concern:**
> "My concern is that she won't be 'awake' for max to ping her"

**Answer from docs:** Independent agents are **always available** because they have persistent sessions stored on disk. When Max sends a message to Yanna, it routes to her session store and she responds. There's no "waking up" needed — the session persists.

### 2. **Session Management** (https://docs.openclaw.ai/concepts/session.md)

**Key point:** Sessions are owned by the Gateway and persist in:
- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- `~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl`

**This means:**
- Yanna's session state is always saved
- When Max messages Yanna, the Gateway routes to her existing session
- No need to "spawn" her each time — she's already there

### 3. **Sub-Agents** (https://docs.openclaw.ai/tools/subagents.md)

**Sub-agent behavior:**
- Sub-agents are **background runs** spawned from an existing agent
- They run in their own session: `agent:<agentId>:subagent:<uuid>`
- When finished, they **announce** results back

**Workspace loading issue confirmed:**
> "Sub-agent context only injects `AGENTS.md` + `TOOLS.md` (no `SOUL.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`, or `BOOTSTRAP.md`)."

**This is the root cause!** Sub-agents don't load `SOUL.md` or other workspace files — only `AGENTS.md` and `TOOLS.md`. This explains why Yanna's identity wasn't loading properly.

### 4. **Presence** (https://docs.openclaw.ai/concepts/presence.md)

**What presence means:**
- Presence is about **clients connected to the Gateway** (mac app, WebChat, CLI, etc.)
- It's **not** about agents being "awake" or "asleep"
- Agents themselves don't have presence states

**Conclusion:** The "awake" question is answered — agents don't need to be "awake" because they're always available via their session store.

### 5. **CLI: agents add** (https://docs.openclaw.ai/cli/agents.md)

**Command to add an independent agent:**
```bash
openclaw agents add yanna --workspace ~/.openclaw/workspace-yanna
```

**Options:**
- `--workspace <dir>` — workspace directory
- `--model <id>` — model for this agent
- `--agent-dir <dir>` — agent state directory
- `--bind <channel[:accountId]>` — routing bindings

## My Recommendation Based on Docs

### **Set Yanna up as an Independent Agent**

**Why:**
1. ✅ **Workspace isolation fixed** — independent agents load ALL workspace files (SOUL.md, IDENTITY.md, AGENTS.md, USER.md, etc.)
2. ✅ **Always "awake"** — agents have persistent sessions, no need to spawn each time
3. ✅ **Can be pinged by Max** — Max can send messages to Yanna via `sessions_send`
4. ✅ **Proper routing** — use bindings to route Discord messages to Yanna
5. ✅ **No workspace isolation issues** — each agent has its own isolated workspace

### **Implementation Steps**

1. **Add Yanna as independent agent:**
   ```bash
   openclaw agents add yanna --workspace ~/.openclaw/workspace-yanna --bind discord:yanna
   ```

2. **Configure routing bindings:**
   - Discord messages to Team CorpOS route to Max (default)
   - Max can send direct messages to Yanna via `sessions_send`

3. **Update Max's dispatch protocol:**
   - Instead of `sessions_spawn` for Yanna, use `sessions_send` to message her directly
   - Yanna maintains her own persistent session

4. **Test workspace loading:**
   - Verify Yanna reads SOUL.md, IDENTITY.md, AGENTS.md on startup
   - Verify Team CorpOS tone guidelines are loaded

### **Bottom Line**

**The links you sent** were about orchestration patterns (how agents communicate), not about spawning independent agents. The docs clearly show that independent agents are the correct way to set up Yanna — they solve the workspace isolation issue and provide persistent sessions.

**Yanna will be "awake"** because independent agents have persistent sessions stored on disk. When Max messages her, the Gateway routes to her session and she responds.
