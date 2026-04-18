/**
 * CALL ROUTER — Pre-Call Resolution Middleware
 * 
 * Sits between Twilio and ElevenLabs. When a call comes in:
 * 1. Twilio hits this endpoint with the called number
 * 2. We resolve the business and receptionist
 * 3. We return the dynamic variables for ElevenLabs
 * 
 * Twilio can call this as a webhook, or Sonar can use it internally
 * before starting an ElevenLabs conversation session.
 */

const express = require('express');
const router = express.Router();

const EL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const SONAR_AGENT_ID = process.env.ELEVENLABS_AGENT_ID || 'agent_6101kp755r1aeg3vj6n3emg1ggft';

function sbQuery(table, method, body, query = '') {
  const url = `${process.env.SONAR_SUPABASE_URL}/rest/v1/${table}${query}`;
  const headers = {
    'apikey': process.env.SONAR_SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${process.env.SONAR_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
  const opts = { method, headers };
  if (body && (method === 'POST' || method === 'PATCH')) opts.body = JSON.stringify(body);
  return fetch(url, opts).then(r => r.json());
}

/**
 * POST /api/call/route
 * 
 * Resolves business + receptionist from the called phone number.
 * Returns dynamic variables for the ElevenLabs session.
 * 
 * Body: { called_number: "+12075550199", caller_number: "+12076801233" }
 * Returns: { resolved: true, variables: {...}, session_config: {...} }
 */
router.post('/route', async (req, res) => {
  try {
    const { called_number, caller_number } = req.body;

    if (!called_number) {
      return res.status(400).json({ error: 'called_number is required', resolved: false });
    }

    // Step 1: Find business by phone number
    const enc = encodeURIComponent;
    const businesses = await sbQuery('businesses', 'GET', null,
      `?phone=eq.${enc(called_number)}&limit=1`
    ) || [];

    if (businesses.length === 0) {
      return res.json({
        resolved: false,
        error: 'No business found for this number',
        called_number,
      });
    }

    const business = businesses[0];
    const userId = business.user_id;

    // Step 1b: Fetch user's intro message prompt from account_settings
    const accountSettings = await sbQuery('account_settings', 'GET', null, `?select=intro_message_prompt&limit=1`) || [];
    const introMessagePrompt = accountSettings[0]?.intro_message_prompt || 'Hey, this is {{receptionist_name}} at {{company_name}}. What can I do for you?';

    // Step 2: Find the active inbound receptionist for this business
    const receptionists = await sbQuery('hired_receptionists', 'GET', null,
      `?user_id=eq.${userId}&call_types=in.(inbound,both)&is_active=is.true&order=hired_at.asc&limit=1`
    ) || [];

    let receptionist = null;
    if (receptionists.length > 0) {
      receptionist = receptionists[0];
    }

    // Step 3: Build dynamic variables for ElevenLabs
    // Format matches ElevenLabs Conversation Initiation Client Data Webhook
    const dynamic_variables = {
      user_id: userId,  // used by all server tools to scope queries
      company_name: business.name || 'Unknown Business',
      business_hours: business.business_hours || 'Contact the business for hours',
      business_phone: business.phone || '',
      business_email: business.email || '',
      customer_name: '',  // populated by identify_caller tool during call
    };

    if (receptionist) {
      dynamic_variables.receptionist_name = receptionist.first_name || receptionist.full_name || 'Receptionist';
      dynamic_variables.receptionist_personality = receptionist.description || 'Professional and helpful';
      dynamic_variables.receptionist_role = receptionist.stereotype || 'Receptionist';

      // Set the voice on the ElevenLabs agent if we have one
      if (receptionist.elevenlabs_voice_id) {
        await syncAgentVoice(receptionist.elevenlabs_voice_id);
      }
    } else {
      dynamic_variables.receptionist_name = 'Receptionist';
      dynamic_variables.receptionist_personality = 'Professional and helpful';
      dynamic_variables.receptionist_role = 'Receptionist';
      dynamic_variables.customer_name = '';
    }

    // Step 4: Return ElevenLabs Conversation Initiation Client Data format
    // Dynamic variables are resolved by ElevenLabs into {{placeholders}} in the agent's base prompt.
    const response = {
      type: 'conversation_initiation_client_data',
      dynamic_variables,
      conversation_config_override: {},
    };

    // Personalized first message using user's intro message prompt
    let firstMessage = introMessagePrompt
      .replace(/\{\{receptionist_name\}\}/g, dynamic_variables.receptionist_name)
      .replace(/\{\{company_name\}\}/g, dynamic_variables.company_name);

    if (receptionist) {
      response.conversation_config_override.agent = {
        first_message: firstMessage,
      };
    }

    // Override the agent's voice if the receptionist has one configured
    if (receptionist?.elevenlabs_voice_id) {
      response.conversation_config_override.tts = {
        voice_id: receptionist.elevenlabs_voice_id,
      };
    }

    // Clean up empty override
    if (Object.keys(response.conversation_config_override).length === 0) {
      delete response.conversation_config_override;
    }

    res.json(response);
  } catch (err) {
    console.error('[CALL-ROUTER] route failed:', err.message);
    res.status(500).json({ error: err.message, resolved: false });
  }
});

/**
 * POST /api/call/session
 * 
 * Full call setup: resolves business + receptionist AND starts an
 * ElevenLabs conversation session with pre-populated dynamic variables.
 * 
 * Body: { called_number: "+12075550199", caller_number: "+12076801233" }
 * Returns: { resolved: true, session: {...}, variables: {...} }
 */
router.post('/session', async (req, res) => {
  try {
    const { called_number, caller_number } = req.body;

    // Step 1: Route the call
    const routeRes = await fetch('http://127.0.0.1:7878/api/call/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ called_number, caller_number }),
    });
    const routeData = await routeRes.json();

    if (!routeData.resolved) {
      return res.json(routeData);
    }

    // Step 2: Start ElevenLabs conversation session with variables
    if (!ELEVENLABS_API_KEY) {
      return res.json({
        resolved: true,
        dynamic_variables: routeData.dynamic_variables,
        session: null,
        note: 'ELEVENLABS_API_KEY not set — returning config only',
      });
    }

    const elRes = await fetch(`${EL}/convai/conversation`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: SONAR_AGENT_ID,
        dynamic_variables: routeData.dynamic_variables,
      }),
    });

    if (!elRes.ok) {
      const errText = await elRes.text();
      return res.json({
        resolved: true,
        dynamic_variables: routeData.dynamic_variables,
        session: null,
        elevenlabs_error: errText.substring(0, 200),
      });
    }

    const session = await elRes.json();

    res.json({
      resolved: true,
      dynamic_variables: routeData.dynamic_variables,
      session: {
        session_id: session.conversation_id,
        ws_url: session.websocket_url,
      },
      business: routeData.business,
      receptionist: routeData.receptionist,
    });
  } catch (err) {
    console.error('[CALL-ROUTER] session failed:', err.message);
    res.status(500).json({ error: err.message, resolved: false });
  }
});

async function syncAgentVoice(voiceId) {
  if (!ELEVENLABS_API_KEY || !SONAR_AGENT_ID) return;
  try {
    await fetch(`${EL}/convai/agents/${SONAR_AGENT_ID}`, {
      method: 'PATCH',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_config: { tts: { voice_id: voiceId } },
      }),
    });
  } catch (err) {
    console.error('[CALL-ROUTER] voice sync failed:', err.message);
  }
}

module.exports = router;
