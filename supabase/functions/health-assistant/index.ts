// Supabase Edge Function: health-assistant
// Secure Gemini-powered AI Health Assistant for HealthThread
// Authenticates users with Supabase Auth, accesses GEMINI_API_KEY securely from secrets,
// and enforces strict medical safety protocols.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MEDICAL_SYSTEM_INSTRUCTION = `You are the HealthThread AI Assistant, an empathetic, clear, and helpful personal health information companion.
Your mission is to help users understand, navigate, and organize their personal health records, medical reports, medications, and general health inquiries.

STRICT MEDICAL SAFETY RULES:
1. NON-DIAGNOSTIC: You provide information and record summaries only. You do not provide definitive medical diagnoses. Always recommend consulting a qualified healthcare professional.
2. EMERGENCY PROTOCOL: If the user describes or asks about acute emergency symptoms (such as sudden crushing chest pain, difficulty breathing, stroke symptoms like facial drooping or slurred speech, severe trauma, or self-harm), IMMEDIATELY advise them to contact emergency medical services (such as 911, 112, or local emergency services).
3. NO DOSAGE PRESCRIBING: Never recommend altering, prescribing, or stopping prescription medications without explicit guidance from their prescribing physician or pharmacist.
4. RECORD ACCURACY: Clearly distinguish between data in the patient's records ("According to your HealthThread records...") versus general medical knowledge.
5. READ-ONLY: You cannot modify or delete database records.`;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Authenticate user using existing Supabase JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'Missing Authorization header. You must be signed in to use Health Assistant.',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Server environment misconfiguration: Missing Supabase URL/key.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized: Invalid or expired session. Please sign in again.',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 2. Read Gemini API key securely from Edge Function secrets
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          error:
            'GEMINI_API_KEY is not configured in Supabase Edge Function Secrets. Please set it using: supabase secrets set GEMINI_API_KEY=your_key',
          code: 'MISSING_GEMINI_KEY',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Parse request payload
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isTest = Boolean(body.isTest);
    const userMessage = (body.message || body.prompt || '').trim();
    const messagesHistory = Array.isArray(body.messages) ? body.messages : [];
    const healthContext = typeof body.healthContext === 'string' ? body.healthContext : '';

    if (!isTest && !userMessage) {
      return new Response(
        JSON.stringify({ error: 'Message cannot be empty.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Use currently supported Gemini model (gemini-2.0-flash with fallback to gemini-1.5-flash)
    const preferredModel = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';

    // 5. Build contents array according to Gemini API spec
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // If healthContext is provided, include it in context
    let fullSystemInstruction = MEDICAL_SYSTEM_INSTRUCTION;
    if (healthContext) {
      fullSystemInstruction += `\n\nPATIENT HEALTH RECORD CONTEXT (Authenticated user ${user.id}):\n${healthContext}`;
    }

    // Handle test query vs actual conversation
    if (isTest) {
      contents.push({
        role: 'user',
        parts: [
          {
            text:
              userMessage ||
              'HealthThread connection verification: Please confirm you are connected and ready to assist.',
          },
        ],
      });
    } else {
      // Append recent conversation history (last 8 turns)
      for (const msg of messagesHistory.slice(-8)) {
        const role = msg.role === 'user' ? 'user' : 'model';
        const text = msg.content || msg.text || '';
        if (text) {
          contents.push({
            role,
            parts: [{ text }],
          });
        }
      }

      // Append current user message
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }],
      });
    }

    // 6. Call Google Gemini API from server
    const geminiPayload = {
      systemInstruction: {
        parts: [{ text: fullSystemInstruction }],
      },
      contents,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1200,
      },
    };

    let geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${preferredModel}:generateContent?key=${geminiApiKey}`;
    let geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    let activeModel = preferredModel;

    // If model not found (404), fallback to gemini-1.5-flash
    if (geminiResponse.status === 404 && preferredModel !== 'gemini-1.5-flash') {
      activeModel = 'gemini-1.5-flash';
      geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${geminiApiKey}`;
      geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });
    }

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      let parsedError: any = null;
      try {
        parsedError = JSON.parse(errorText);
      } catch {
        // Not JSON
      }

      const errorMessage =
        parsedError?.error?.message || `Gemini API responded with status ${geminiResponse.status}`;

      return new Response(
        JSON.stringify({
          error: `Gemini service error: ${errorMessage}`,
          status: geminiResponse.status,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const geminiData = await geminiResponse.json();
    const replyText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      'I processed your request, but could not generate a response. Please rephrase your question.';

    // 7. Return successful response to frontend
    return new Response(
      JSON.stringify({
        success: true,
        reply: replyText,
        model: activeModel,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message || 'An unexpected error occurred in Health Assistant function.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
