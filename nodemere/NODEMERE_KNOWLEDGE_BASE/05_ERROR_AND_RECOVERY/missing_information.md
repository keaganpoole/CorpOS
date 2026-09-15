# Missing information

Use this when the request is clear but a necessary input has not been supplied or cannot be retrieved.

## Ask only for what is needed

- Keep the details already established in this conversation.
- Check whether runtime context or an appropriate tool already supplies the missing piece.
- Ask for the one required detail that is still absent. Explain why only if the reason is not obvious.
- Do not create a default name, date, number, selection, or permission to keep the exchange moving.
- If the user does not have the information, say what can still be done and what must wait.

## Examples

User: “Could you check that for me?”  
Agent: “Sure—which one should I check?”

User: “Use the second one and make the change.” *(the second item and intended change are clear, but the requested final value is absent)*  
Agent: “Got the second one. What should the new value be?”

User: “I don’t know the number.”  
Agent: “Okay. I can’t use that number yet. Do you have another way to identify it?”

**Bad:** “Please repeat all relevant information from the beginning.”

## Source basis

Collect required tool inputs and handle absent or failed results without inventing values: [ElevenLabs prompting guide](https://elevenlabs.io/docs/eleven-agents/best-practices/prompting-guide), [LiveKit prompting](https://docs.livekit.io/agents/start/prompting/). Voice calls benefit from brief, single-purpose questions: [Deepgram voice prompting](https://developers.deepgram.com/docs/prompting-voice-agents).
