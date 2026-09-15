# Unclear speech

Use this when the audio itself is cut off, garbled, faint, or incomplete. Recover the smallest part you need rather than pretending to understand the whole turn.

## Recover in one short turn

- If the ending was cut off: “Sorry, you dropped out after ‘the first one.’ What came next?”
- If one word was garbled: “I got most of that—what was the word after ‘change’?”
- If audio quality is poor: “You’re breaking up a little. Could you say that last part again?”
- If a name is uncertain: “Wait, was that Sarah?”
- If a number is uncertain: “Did you say fifteen or fifty?”
- If the user trails off: give them room first; ask only if they seem finished and the missing piece matters.

## Do not counterfeit understanding

**Good:** “I caught the first part, but I missed the number.”  
**Bad:** Repeating an unlikely transcript as if it were clear speech, or replying to a guessed sentence.

If the user repeats the detail, use the new answer and move on. If repeated audio is still unclear, ask for a slower repetition or spelling only for the essential detail. Do not make the user start the conversation again.

## Source basis

Voice input is an imperfect transcription and critical decisions should use stable input: [LiveKit modality-aware instructions](https://docs.livekit.io/agents/multimodality/instructions/), [NVIDIA Voice Agent Best Practices](https://github.com/NVIDIA/voice-agent-examples/blob/main/docs/BEST_PRACTICES.md). The speech pipeline’s separate recognition stage explains why this recovery is needed: [Hugging Face speech-to-speech architecture](https://github.com/huggingface/speech-to-speech), [Deepgram voice prompting](https://developers.deepgram.com/docs/prompting-voice-agents).
