import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function friendlyDeleteError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('super admin accounts')) {
    return 'Super Admin accounts must be demoted by a database operator before deletion.';
  }
  if (normalized.includes('promote another admin') || normalized.includes('needs another admin')) {
    return message;
  }
  return 'MiniTrello could not delete this account. Please try again.';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('delete-account is missing a required Supabase environment variable.');
    return json({ error: 'Account deletion is not configured on the server.' }, 500);
  }
  if (!authorization) {
    return json({ error: 'Authentication required.' }, 401);
  }

  let confirmationEmail = '';
  try {
    const body = await request.json();
    confirmationEmail = String(body?.confirmationEmail || '').trim().toLowerCase();
  } catch {
    return json({ error: 'A confirmation Gmail is required.' }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ error: 'Your session is no longer valid. Sign in and try again.' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('email')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    console.error('Unable to load the profile before account deletion:', profileError);
    return json({ error: 'MiniTrello could not find your account profile.' }, 404);
  }
  if (!confirmationEmail || confirmationEmail !== profile.email.toLowerCase()) {
    return json({ error: 'The confirmation Gmail does not match your current MiniTrello login.' }, 400);
  }

  // Never accept a user ID from the browser. The only deletion target is the
  // user verified from this request's bearer token.
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(authData.user.id);
  if (deleteError) {
    console.error('Auth Admin account deletion failed:', deleteError);
    return json({ error: friendlyDeleteError(deleteError.message) }, 409);
  }

  return json({ ok: true });
});
