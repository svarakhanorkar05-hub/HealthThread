import { supabase } from '@/lib/supabase';
import type { AIChatMessage } from '@/types/database';

export interface AssistantResponse {
  reply: string;
  configured: boolean;
  model?: string;
  error?: string;
}

export interface GeminiTestResult {
  success: boolean;
  reply?: string;
  model?: string;
  error?: string;
  status?: number;
}

/**
 * Parses Supabase FunctionsError (FunctionsHttpError, FunctionsRelayError, FunctionsFetchError)
 * to extract actual useful error messages and HTTP response bodies instead of generic messages.
 */
async function parseFunctionError(error: any): Promise<string> {
  if (!error) return 'Unknown error occurred.';

  // Check if it's FunctionsHttpError with a response context
  if (error.context) {
    try {
      const response = error.context.clone ? error.context.clone() : error.context;
      const status = response.status;

      if (status === 404) {
        return "The 'health-assistant' Edge Function is not deployed on your Supabase project (HTTP 404). Please run 'supabase functions deploy health-assistant'.";
      }

      if (status === 401) {
        return 'Your session has expired or is invalid (HTTP 401). Please sign in again.';
      }

      const json = await response.json().catch(() => null);
      if (json) {
        if (json.error) return json.error;
        if (json.message) return json.message;
      }

      const text = await response.text().catch(() => null);
      if (text) return `HTTP ${status}: ${text}`;
    } catch {
      // Fall through to error.message
    }
  }

  if (error.name === 'FunctionsFetchError') {
    return 'Network error (FunctionsFetchError): Could not reach the Edge Function. Please check your internet connection or verify CORS and project URL.';
  }

  if (error.name === 'FunctionsRelayError') {
    return `Relay error (FunctionsRelayError): Failed to relay request to Edge Function: ${error.message}`;
  }

  if (error.name === 'FunctionsHttpError') {
    const status = error.context?.status;
    if (status === 404) {
      return "The 'health-assistant' Edge Function is not deployed on your Supabase project (HTTP 404).";
    }
    return `Edge Function HTTP ${status || 'Error'}: ${error.message}`;
  }

  return error.message || 'Unable to connect to Health Assistant.';
}

/**
 * Gathers and formats the authenticated patient's clinical context safely
 */
export async function buildUserClinicalContext(userId: string): Promise<string> {
  const [profileRes, medsRes, recordsRes, vaccsRes, docsRes, apptsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('medications').select('*').eq('user_id', userId),
    supabase
      .from('health_records')
      .select('*')
      .eq('user_id', userId)
      .order('event_date', { ascending: false })
      .limit(20),
    supabase
      .from('vaccinations')
      .select('*')
      .eq('user_id', userId)
      .order('date_administered', { ascending: false })
      .limit(10),
    supabase
      .from('documents')
      .select('title, category, document_date, extracted_text')
      .eq('user_id', userId)
      .limit(10),
    supabase
      .from('appointments')
      .select('*')
      .eq('user_id', userId)
      .order('appointment_date', { ascending: false })
      .limit(10),
  ]);

  const p = profileRes.data;
  const sections: string[] = [];

  // Profile
  if (p) {
    sections.push(
      `PATIENT DEMOGRAPHICS:\n` +
        `- Biological Sex: ${p.biological_sex || 'Unspecified'}\n` +
        `- Date of Birth: ${p.date_of_birth || 'Unspecified'}\n` +
        `- Blood Type: ${p.blood_type || 'Unknown'}\n` +
        `- Height: ${p.height_cm ? `${p.height_cm} cm` : 'Not recorded'}, Weight: ${p.weight_kg ? `${p.weight_kg} kg` : 'Not recorded'}`
    );
  }

  // Medications
  const meds = medsRes.data || [];
  if (meds.length > 0) {
    const medList = meds
      .map(
        (m) =>
          `• ${m.name} (${m.dosage}) - ${m.frequency || 'as directed'}, Active: ${m.active ? 'Yes' : 'Discontinued'}${m.notes ? `, Instructions: ${m.notes}` : ''}`
      )
      .join('\n');
    sections.push(`MEDICATIONS:\n${medList}`);
  } else {
    sections.push(`MEDICATIONS: None recorded.`);
  }

  // Health Records & Allergies
  const records = recordsRes.data || [];
  const allergies = records.filter((r) => r.record_type === 'allergy');
  const conditions = records.filter((r) => r.record_type === 'condition');
  const events = records.filter(
    (r) => r.record_type !== 'allergy' && r.record_type !== 'condition'
  );

  if (allergies.length > 0) {
    sections.push(
      `KNOWN ALLERGIES:\n${allergies.map((a) => `• ${a.title}${a.severity ? ` (${a.severity})` : ''}`).join('\n')}`
    );
  }

  if (conditions.length > 0) {
    sections.push(`MEDICAL CONDITIONS:\n${conditions.map((c) => `• ${c.title}`).join('\n')}`);
  }

  if (events.length > 0) {
    const eventList = events
      .slice(0, 10)
      .map(
        (e) =>
          `• [${e.event_date}] ${e.title} (${e.record_type.replace('_', ' ')})${e.provider ? ` with ${e.provider}` : ''}${e.description ? ` - ${e.description}` : ''}`
      )
      .join('\n');
    sections.push(`RECENT HEALTH TIMELINE EVENTS:\n${eventList}`);
  }

  // Vaccinations
  const vaccs = vaccsRes.data || [];
  if (vaccs.length > 0) {
    const vaccList = vaccs
      .map(
        (v) =>
          `• ${v.vaccine_name} administered on ${v.date_administered}${v.next_due_date ? `, Next due: ${v.next_due_date}` : ''}`
      )
      .join('\n');
    sections.push(`VACCINATION HISTORY:\n${vaccList}`);
  }

  // Uploaded Documents & OCR summaries
  const docs = docsRes.data || [];
  if (docs.length > 0) {
    const docList = docs
      .map(
        (d) =>
          `• [${d.category}] "${d.title}" (${d.document_date || 'No date'})${d.extracted_text ? ` - Summary/Findings: ${d.extracted_text.slice(0, 150)}...` : ''}`
      )
      .join('\n');
    sections.push(`STORED MEDICAL DOCUMENTS & OCR FINDINGS:\n${docList}`);
  }

  // Appointments
  const appts = apptsRes.data || [];
  if (appts.length > 0) {
    const apptList = appts
      .slice(0, 5)
      .map(
        (a) =>
          `• ${a.title} on ${new Date(a.appointment_date).toLocaleDateString()} (${a.status})${a.provider ? ` with ${a.provider}` : ''}`
      )
      .join('\n');
    sections.push(`APPOINTMENTS:\n${apptList}`);
  }

  return sections.join('\n\n');
}

/**
 * Sends a message to the Gemini-powered AI Health Assistant via Supabase Edge Function `health-assistant`
 */
export async function askHealthAssistant(
  userId: string,
  userMessage: string,
  history: AIChatMessage[]
): Promise<AssistantResponse> {
  const healthContext = await buildUserClinicalContext(userId);

  try {
    const { data, error } = await supabase.functions.invoke('health-assistant', {
      body: {
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        message: userMessage,
        healthContext,
      },
    });

    if (error) {
      const detailedMessage = await parseFunctionError(error);
      return {
        configured: false,
        reply: `Unable to reach Health Assistant: ${detailedMessage}`,
        error: detailedMessage,
      };
    }

    if (data?.error) {
      return {
        configured: false,
        reply: data.error,
        error: data.error,
      };
    }

    return {
      reply: data.reply || 'No response received from AI assistant.',
      configured: true,
      model: data.model,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Assistant request failed';
    return {
      configured: false,
      reply: `Connection error: ${msg}`,
      error: msg,
    };
  }
}

/**
 * Tests the Gemini API connection via the `health-assistant` Edge Function
 */
export async function testGeminiConnection(): Promise<GeminiTestResult> {
  try {
    const { data, error } = await supabase.functions.invoke('health-assistant', {
      body: {
        isTest: true,
        message: 'HealthThread test ping: please confirm Gemini connection and state your model.',
      },
    });

    if (error) {
      const detailedMessage = await parseFunctionError(error);
      return {
        success: false,
        error: detailedMessage,
      };
    }

    if (data?.error) {
      return {
        success: false,
        error: data.error,
        status: data.status,
      };
    }

    return {
      success: true,
      reply: data.reply,
      model: data.model,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to test Gemini connection.',
    };
  }
}

/**
 * Loads persistent chat messages for the current user
 */
export async function loadChatMessages(userId: string): Promise<AIChatMessage[]> {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('Could not load chat history from database:', error.message);
    return [];
  }

  return (data || []) as AIChatMessage[];
}

/**
 * Saves a new chat message to the database
 */
export async function saveChatMessage(
  userId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<AIChatMessage | null> {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .insert({
      user_id: userId,
      role,
      content,
    })
    .select()
    .single();

  if (error) {
    console.warn('Could not save chat message to database:', error.message);
    return null;
  }

  return data as AIChatMessage;
}

/**
 * Clears chat history for the user
 */
export async function clearChatHistory(userId: string): Promise<void> {
  const { error } = await supabase.from('ai_chat_messages').delete().eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to clear chat history: ${error.message}`);
  }
}
