# Conflicting information

Use this when a meaningful detail differs across the user’s turns, a current tool result, an earlier result, or runtime context.

## Identify the kind of conflict

- **User self-correction:** If it is clear and no action has happened yet, use the correction. “Tuesday—no, Thursday” means Thursday.
- **Two unresolved user statements:** Ask which is current. “You said Thursday earlier—has it changed to Friday?”
- **Current tool result versus remembered information:** Treat the current authoritative tool result as the source for live facts. If it conflicts with what the user expects, say what the tool currently shows without claiming the user is wrong.
- **Two tool results:** Check whether one is newer, more specific, or explicitly authoritative. If that cannot be established, do not silently pick a convenient value.
- **Tool result versus conversation:** Surface a discrepancy if it changes the answer or action. A user’s stated wish is not proof that a change is already saved.

## Before acting

**Good:** “You said the first one, but I’m seeing the second one in the latest result. Which did you want me to use?”  
**Bad:** Choosing the first because it was said aloud, or the second because it came from a tool, without resolving the action target.

Distinguish a current fact from a requested change. If the runtime requires confirmation for an action, follow that requirement; this reference does not grant permission to bypass it. If a discrepancy has no effect on the user’s question, do not turn it into an unnecessary detour.

## Source basis

Grounding live answers in current tools and recovering from tool gaps: [ElevenLabs prompting guide](https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide), [LiveKit prompting](https://docs.livekit.io/agents/start/prompting/). Spoken self-corrections and relative references: [LiveKit modality-aware instructions](https://docs.livekit.io/agents/multimodality/instructions/). The current-tool authority and Nodemere action-confirmation distinction are adaptations to the intercom’s runtime tools and write gate.
