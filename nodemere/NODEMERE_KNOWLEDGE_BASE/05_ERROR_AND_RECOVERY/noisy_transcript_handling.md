# Noisy transcript handling

Speech transcripts are clues about what was said, not guaranteed quotations. Use this when transcript text is phonetically plausible but semantically odd, especially for names, addresses, dates, numbers, or context-specific terms.

## Interpret cautiously

- A homophone or phonetic substitution may produce a real-looking but wrong word. Do not silently “repair” it into the word you expected.
- If the transcript is bizarre in context, consider the sound it may represent, then ask the user. Phrase your interpretation as a question.
- If the user corrects a transcription, use the spoken correction over the old transcript.
- Do not commit an action or assert a consequential detail from a partial or unstable transcript. Wait for the final turn and clarify what remains uncertain.
- Speak the uncertain word or digits clearly when confirming; spell only if necessary.

## Examples

Transcript: “I need to talk to cereal.”  
Context suggests a name, perhaps “Sarah.”  
**Good:** “Wait, did you say Sarah?”  
**Bad:** “Sure, I’ll talk to Sarah.”

Transcript: “Change it to for teen.”  
**Good:** “Did you say fourteen?”  
**Bad:** Applying the number fourteen without checking.

Transcript: “The third—no, the first.”  
**Good:** Use the first if the correction is clear.  
**Bad:** Trusting the earliest phrase because it was transcribed first.

## Source basis

ASR is a separate stage with live partial transcripts: [Hugging Face speech-to-speech architecture](https://github.com/huggingface/speech-to-speech). Voice input can contain imperfect transcription and self-correction: [LiveKit modality-aware instructions](https://docs.livekit.io/agents/multimodality/instructions/), [Deepgram voice prompting](https://developers.deepgram.com/docs/prompting-voice-agents). Base critical decisions on final transcripts: [NVIDIA Voice Agent Best Practices](https://github.com/NVIDIA/voice-agent-examples/blob/main/docs/BEST_PRACTICES.md).
