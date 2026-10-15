import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

function response(status: number, message?: string) {
  return new Response(message ? JSON.stringify({ error: message }) : null, {
    status,
    headers: {
      ...corsHeaders,
      ...(message ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return response(204);
  if (request.method !== 'POST') return response(405, 'Method not allowed.');

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return response(401, 'Authentication is required.');

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Account deletion function is missing required server configuration.');
    return response(500, 'Account deletion is not configured.');
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(accessToken);
  if (userError || !userData.user) return response(401, 'Your session is invalid or expired.');
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(accessToken);
  const authTime = Number(claimsData?.claims.auth_time);
  const now = Math.floor(Date.now() / 1000);
  if (
    claimsError
    || !Number.isFinite(authTime)
    || authTime > now + 60
    || now - authTime > 600
  ) {
    return response(401, 'Please sign in again before deleting your account.');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = adminClient.storage.from('health-documents');
  const filePaths: string[] = [];
  const folders = [userData.user.id];

  try {
    while (folders.length > 0) {
      const folder = folders.pop()!;
      let offset = 0;

      while (true) {
        const { data: entries, error: listError } = await bucket.list(folder, { limit: 100, offset });
        if (listError) throw listError;
        if (!entries.length) break;

        for (const entry of entries) {
          const path = `${folder}/${entry.name}`;
          if (entry.id === null) folders.push(path);
          else filePaths.push(path);
        }
        offset += entries.length;
        if (entries.length < 100) break;
      }
    }

    for (let index = 0; index < filePaths.length; index += 100) {
      const { error: removeError } = await bucket.remove(filePaths.slice(index, index + 100));
      if (removeError) throw removeError;
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userData.user.id);
    if (deleteUserError) throw deleteUserError;
  } catch {
    console.error('Account deletion failed for authenticated user.');
    return response(500, 'Account deletion could not be completed. Please try again or contact support.');
  }

  return response(204);
});
