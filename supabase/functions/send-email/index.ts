// Supabase Edge Function: send-email
// Sends transactional emails for invitations, password reset handoff, RSVP confirmation,
// and operational notifications. Uses Resend by default.
// Required secrets:
//   RESEND_API_KEY
//   EMAIL_FROM
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type EmailPurpose =
  | 'invitation'
  | 'password_reset'
  | 'rsvp_confirmation'
  | 'staff_notification'
  | 'generic';

interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  purpose?: EmailPurpose;
  organizationId?: string;
  eventId?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('EMAIL_FROM');

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !emailFrom) {
    return json({ error: 'Email service is not configured.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, ''),
  );

  if (userError || !userData.user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const payload = (await req.json()) as SendEmailRequest;
  const to = sanitizeEmail(payload.to || '');

  if (!to || !payload.subject || !payload.html) {
    return json({ error: 'Missing to, subject, or html.' }, 400);
  }

  if (payload.organizationId) {
    const { data: membership, error } = await supabase
      .from('organization_memberships')
      .select('role,status')
      .eq('organization_id', payload.organizationId)
      .eq('user_id', userData.user.id)
      .eq('status', 'active')
      .single();

    if (error || !membership) {
      return json({ error: 'Forbidden' }, 403);
    }
  }

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    }),
  });

  const resendBody = await resendResponse.json().catch(() => ({}));

  await supabase.from('audit_logs').insert({
    organization_id: payload.organizationId ?? null,
    event_id: payload.eventId ?? null,
    actor_id: userData.user.id,
    action: resendResponse.ok ? `email.${payload.purpose ?? 'generic'}.sent` : 'email.failed',
    entity_type: 'email',
    after_data: {
      to,
      subject: payload.subject,
      purpose: payload.purpose ?? 'generic',
      providerStatus: resendResponse.status,
      providerResponse: resendBody,
    },
  });

  if (!resendResponse.ok) {
    return json({ error: 'Email provider rejected request.', details: resendBody }, 502);
  }

  return json({ ok: true, provider: resendBody });
});
