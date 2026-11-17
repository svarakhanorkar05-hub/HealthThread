// Supabase Edge Function: ai-health-assistant
// Handles AI conversational health queries securely with user authorization and strict medical safety

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_INSTRUCTION = `You are the HealthThread AI Assistant, an empathetic, clear, and helpful digital personal health companion.
Your mission is to help users navigate, understand, and organize their personal health records, medical reports, medications, and general health inquiries.

STRICT MEDICAL SAFETY RULES:
1. NON-DIAGNOSTIC: You provide information and record summaries only. You do not provide definitive medical diagnoses. Always recommend consulting a qualified physician or healthcare professional.
2. EMERGENCY PROTOCOL: If the user asks about or displays acute emergency symptoms (such as acute chest pain, sudden weakness or numbness, severe shortness of breath, anaphylaxis, severe head trauma, or self-harm), IMMEDIATELY advise them to call emergency services (such as 911, 112, or their local emergency number).
3. NO DOSAGE PRESCRIBING: Never recommend changing, starting, or discontinuing medication dosages without direct guidance from their prescribing doctor.
4. DATA DISTINCTION: Clearly distinguish between facts recorded in the user's HealthThread records (e.g. "According to your records...") versus general medical background knowledge.
5. READ-ONLY: You cannot edit or delete database records.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate user with their token
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages, userMessage, healthContext } = await req.json();

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    // If no API key is configured, return the truthful configuration message
    if (!geminiKey && !openaiKey) {
      return new Response(
        JSON.stringify({
          configured: false,
          reply:
            "The HealthThread AI Assistant backend is connected and ready, but an AI Provider API key has not yet been configured in Supabase Secrets.\n\n" +
            "To enable live AI responses, set your API key in Supabase:\n" +
            "• Option 1 (Google Gemini): `supabase secrets set GEMINI_API_KEY=your_key`\n" +
            "• Option 2 (OpenAI): `supabase secrets set OPENAI_API_KEY=your_key`\n\n" +
            "Once configured, you will receive real-time, context-aware answers about your health records.",
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let reply = '';

    // If Gemini key is set, call Gemini API
    if (geminiKey) {
      const promptParts = [
        { text: `${SYSTEM_INSTRUCTION}\n\nPATIENT HEALTH RECORD CONTEXT:\n${healthContext || 'No personal records provided.'}\n` },
      ];

      // Add conversation history
      if (Array.isArray(messages)) {
        for (const m of messages.slice(-6)) {
          promptParts.push({ text: `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}` });
        }
      }

      promptParts.push({ text: `User: ${userMessage}\nAssistant:` });

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: promptParts }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1000,
            },
          }),
        }
      );

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        throw new Error(`Gemini API error: ${errText}`);
      }

      const geminiData = await geminiRes.json();
      reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    } else if (openaiKey) {
      // Call OpenAI API
      const chatMessages = [
        {
          role: 'system',
          content: `${SYSTEM_INSTRUCTION}\n\nPATIENT HEALTH RECORD CONTEXT:\n${healthContext || 'No records provided.'}`,
        },
      ];

      if (Array.isArray(messages)) {
        for (const m of messages.slice(-6)) {
          chatMessages.push({ role: m.role, content: m.content });
        }
      }

      chatMessages.push({ role: 'user', content: userMessage });

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: chatMessages,
          temperature: 0.3,
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        throw new Error(`OpenAI API error: ${errText}`);
      }

      const openaiData = await openaiRes.json();
      reply = openaiData.choices?.[0]?.message?.content || 'No response generated.';
    }

    return new Response(JSON.stringify({ configured: true, reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'AI Assistant processing failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
