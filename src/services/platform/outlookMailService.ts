import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';

export interface OutlookConnectionStatus {
  connected: boolean;
  email?: string;
  clientId?: string;
}

export async function getOutlookConnectionStatus(): Promise<OutlookConnectionStatus> {
  if (!isSupabaseConfigured()) return { connected: false };
  const { data, error } = await getSupabaseClient().rpc('get_platform_outlook_status');
  if (error) {
    const message = error.message || '';
    if (/could not find the function|does not exist/i.test(message)) {
      throw new Error('Apply migration 0015_platform_outlook_graph.sql in the Supabase SQL Editor, then refresh.');
    }
    throw error;
  }
  if (!data?.ok) throw new Error(String(data?.error || 'Could not load Outlook status.'));
  return {
    connected: Boolean(data.connected),
    email: data.email ? String(data.email) : undefined,
    clientId: data.clientId ? String(data.clientId) : undefined,
  };
}

export async function disconnectOutlook(): Promise<void> {
  const { data, error } = await getSupabaseClient().rpc('disconnect_platform_outlook');
  if (error) throw error;
  if (!data?.ok) throw new Error(String(data?.error || 'Could not disconnect Outlook.'));
}

export async function exchangeOutlookAuthCode(input: {
  clientId: string;
  code: string;
  verifier: string;
  redirectUri: string;
}): Promise<{ email: string }> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  const { data, error } = await getSupabaseClient().functions.invoke('send-email', {
    body: {
      action: 'outlook_exchange',
      clientId: input.clientId,
      code: input.code,
      verifier: input.verifier,
      redirectUri: input.redirectUri,
    },
  });
  if (error) {
    const details = data && typeof data === 'object' && data !== null && 'error' in data ? String((data as { error?: unknown }).error || '') : '';
    throw new Error(details || error.message || 'Could not connect Outlook.');
  }
  if (data && typeof data === 'object' && 'error' in data && !(data as { ok?: unknown }).ok) {
    throw new Error(String((data as { error?: unknown }).error || 'Could not connect Outlook.'));
  }
  return { email: String((data as { email?: string })?.email || '') };
}
