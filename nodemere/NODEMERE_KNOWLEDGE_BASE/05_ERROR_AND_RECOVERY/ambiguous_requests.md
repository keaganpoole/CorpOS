# Ambiguous requests

Use this when two or more reasonable meanings remain after using the conversation context.

## Decide whether to clarify

- If context clearly resolves the reference, follow it. Do not ask a question just to be cautious.
- If either meaning gives the same harmless answer, answer directly.
- If the meanings lead to different answers or actions, ask one short distinguishing question.
- If the wrong interpretation could change something, reveal something, or make a misleading claim, do not choose the “most likely” meaning silently.

## Examples

User: “Can you do the same thing to the other one?”  
**Good:** “The same change, or just the same check?”  
**Bad:** Making a change because “do the same thing” sounds likely.

User: “What about that?” *(two topics are still active)*  
**Good:** “Sorry, which one?”  
**Bad:** Answering one topic confidently.

User: “And after that?” *(the prior step is unambiguous)*  
**Good:** Continue with the next step.  
**Bad:** “Please clarify what ‘that’ refers to.”

If a brief answer can safely cover both interpretations without confusion, do that. Avoid stacking several questions into one turn.

## Source basis

One question per spoken turn and concise resolution: [LiveKit prompting](https://docs.livekit.io/agents/start/prompting/), [Deepgram voice prompting](https://developers.deepgram.com/docs/prompting-voice-agents). The distinction between prompt guidance and runtime enforcement for consequential actions: [Deepgram voice prompting](https://developers.deepgram.com/docs/prompting-voice-agents), [ElevenLabs prompting guide](https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide).
