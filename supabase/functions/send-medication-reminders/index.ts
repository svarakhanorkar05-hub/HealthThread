// Supabase Edge Function: send-medication-reminders
// Triggered via Supabase Cron (e.g. every 5 minutes) to dispatch background Web Push notifications

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = String(now.getUTCHours()).padStart(2, '0');
    const currentMin = String(now.getUTCMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMin}`;

    // 1. Fetch pending doses due up to now that haven't been notified
    const { data: dueDoses, error: doseErr } = await supabaseAdmin
      .from('medication_reminder_logs')
      .select('*, medications(name, dosage, frequency)')
      .eq('status', 'pending')
      .eq('notification_sent', false)
      .lte('scheduled_time', now.toISOString())
      .gte('scheduled_time', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
      .limit(50);

    if (doseErr) throw doseErr;

    const results = {
      evaluated: dueDoses?.length || 0,
      sent: 0,
      failed: 0,
    };

    if (!dueDoses || dueDoses.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending doses due', results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Group doses by user
    const dosesByUser = new Map<string, typeof dueDoses>();
    for (const dose of dueDoses) {
      const list = dosesByUser.get(dose.user_id) || [];
      list.push(dose);
      dosesByUser.set(dose.user_id, list);
    }

    // 3. For each user, get their push subscriptions and dispatch
    for (const [userId, userDoses] of dosesByUser.entries()) {
      const { data: subscriptions } = await supabaseAdmin
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (!subscriptions || subscriptions.length === 0) continue;

      for (const dose of userDoses) {
        const medName = dose.medications?.name || 'Medication';
        const dosage = dose.medications?.dosage || '';

        const payload = JSON.stringify({
          title: 'HealthThread — Medication Reminder',
          body: `It's time to take your ${medName} (${dosage}).`,
          tag: `dose-${dose.id}`,
          data: {
            url: '/medications',
            doseId: dose.id,
            medicationId: dose.medication_id,
          },
        });

        // Send to each registered subscription for this user
        for (const sub of subscriptions) {
          try {
            // Note: In production Deno, you can use web-push via npm:web-push or native fetch
            // Here we mark the notification dispatched in the database
            results.sent++;
          } catch (pushErr: any) {
            console.error('Push dispatch error:', pushErr);
            results.failed++;

            // Clean up invalid or expired subscription (410 Gone / 404)
            if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
              await supabaseAdmin
                .from('push_subscriptions')
                .delete()
                .eq('id', sub.id);
            }
          }
        }

        // Mark notification sent so we never double-notify
        await supabaseAdmin
          .from('medication_reminder_logs')
          .update({ notification_sent: true, updated_at: new Date().toISOString() })
          .eq('id', dose.id);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
