/**
 * ElevenLabs Voice Sync
 * 
 * Updates the ElevenLabs agent's TTS voice to match the assigned receptionist.
 * Called whenever a receptionist's call_types is changed to In/Out/Both.
 */

const EL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const SONAR_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_4901kp6x416efqd8x211a49pvknf';

/**
 * Sync the ElevenLabs agent's voice to match a receptionist.
 * @param {string|null} voiceId - The receptionist's elevenlabs_voice_id
 * @param {string} receptionistName - For logging
 * @returns {Promise<{success: boolean, voice_id: string|null, error?: string}>}
 */
async function syncAgentVoice(voiceId, receptionistName) {
  if (!ELEVENLABS_API_KEY) {
    console.warn('[VOICE-SYNC] ELEVENLABS_API_KEY not set, skipping voice sync');
    return { success: false, voice_id: null, error: 'No API key' };
  }

  if (!SONAR_AGENT_ID) {
    console.warn('[VOICE-SYNC] No agent ID configured, skipping voice sync');
    return { success: false, voice_id: null, error: 'No agent ID' };
  }

  const payload = {
    conversation_config: {
      tts: {},
    },
  };

  if (voiceId) {
    payload.conversation_config.tts.voice_id = voiceId;
  }

  try {
    const res = await fetch(`${EL}/convai/agents/${SONAR_AGENT_ID}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log(`[VOICE-SYNC] Updated agent voice to ${voiceId || 'default'} for ${receptionistName}`);
      return { success: true, voice_id: voiceId };
    } else {
      const err = await res.text();
      console.error(`[VOICE-SYNC] Failed [${res.status}]:`, err.substring(0, 200));
      return { success: false, voice_id: null, error: err.substring(0, 200) };
    }
  } catch (err) {
    console.error('[VOICE-SYNC] Error:', err.message);
    return { success: false, voice_id: null, error: err.message };
  }
}

module.exports = { syncAgentVoice };
