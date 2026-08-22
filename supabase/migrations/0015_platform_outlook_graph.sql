-- Review #202: store Microsoft Graph tokens for unattended Outlook send.
-- SMTP ports 25/465/587 are blocked or unusable from Supabase Edge.
-- Service role reads refresh tokens; authenticated clients never select them.

create table if not exists public.platform_mail_secrets (
  id text primary key,
  provider text not null default 'microsoft_graph',
  client_id text,
  refresh_token text,
  connected_email text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.platform_mail_secrets enable row level security;

create or replace function public.get_platform_outlook_status()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.platform_mail_secrets%rowtype;
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  select * into row from public.platform_mail_secrets where id = 'default';
  return jsonb_build_object(
    'ok', true,
    'connected', row.refresh_token is not null and length(trim(row.refresh_token)) > 0,
    'email', row.connected_email,
    'clientId', row.client_id
  );
end;
$$;

create or replace function public.save_platform_outlook_connection(
  p_client_id text,
  p_refresh_token text,
  p_connected_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_refresh_token is null or length(trim(p_refresh_token)) < 20 then
    return jsonb_build_object('ok', false, 'error', 'invalid_refresh_token');
  end if;
  insert into public.platform_mail_secrets (id, provider, client_id, refresh_token, connected_email, updated_by, updated_at)
  values (
    'default',
    'microsoft_graph',
    nullif(trim(coalesce(p_client_id, '')), ''),
    trim(p_refresh_token),
    nullif(trim(coalesce(p_connected_email, '')), ''),
    auth.uid(),
    now()
  )
  on conflict (id) do update set
    provider = 'microsoft_graph',
    client_id = excluded.client_id,
    refresh_token = excluded.refresh_token,
    connected_email = excluded.connected_email,
    updated_by = excluded.updated_by,
    updated_at = now();
  insert into public.platform_audit_logs (platform_user_id, action, target_type, target_id, metadata)
  values (
    auth.uid(),
    'outlook_connected',
    'platform_mail_secrets',
    'default',
    jsonb_build_object('email', nullif(trim(coalesce(p_connected_email, '')), ''))
  );
  return jsonb_build_object('ok', true, 'email', nullif(trim(coalesce(p_connected_email, '')), ''));
end;
$$;

create or replace function public.disconnect_platform_outlook()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  update public.platform_mail_secrets
    set refresh_token = null, connected_email = null, updated_at = now(), updated_by = auth.uid()
    where id = 'default';
  insert into public.platform_audit_logs (platform_user_id, action, target_type, target_id)
  values (auth.uid(), 'outlook_disconnected', 'platform_mail_secrets', 'default');
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.get_platform_outlook_status() to authenticated;
grant execute on function public.save_platform_outlook_connection(text, text, text) to authenticated;
grant execute on function public.disconnect_platform_outlook() to authenticated;
