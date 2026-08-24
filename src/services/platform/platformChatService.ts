import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { describeUnknownError } from '../../utils/unknownError';

export interface PlatformVenueMessage {
  id: string;
  organizationId: string;
  senderUserId: string;
  senderSide: 'platform' | 'venue';
  body: string;
  createdAt: string;
}

function requireSupabase() {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured.');
  return getSupabaseClient('platform');
}

function mapMessage(row: Record<string, unknown>): PlatformVenueMessage {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    senderUserId: String(row.sender_user_id),
    senderSide: row.sender_side === 'platform' ? 'platform' : 'venue',
    body: String(row.body || ''),
    createdAt: String(row.created_at),
  };
}

export async function listPlatformVenueMessages(organizationId: string): Promise<PlatformVenueMessage[]> {
  if (!organizationId) return [];
  const { data, error } = await requireSupabase()
    .from('platform_venue_messages')
    .select('id,organization_id,sender_user_id,sender_side,body,created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(describeUnknownError(error, 'Could not load platform chat.'));
  return (data || []).map((row) => mapMessage(row as Record<string, unknown>));
}

export async function sendPlatformVenueMessage(organizationId: string, body: string, senderSide: 'platform' | 'venue'): Promise<PlatformVenueMessage> {
  const supabase = requireSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('You must be signed in to send a platform message.');
  const { data, error } = await supabase
    .from('platform_venue_messages')
    .insert({ organization_id: organizationId, sender_user_id: userData.user.id, sender_side: senderSide, body: body.trim() })
    .select('id,organization_id,sender_user_id,sender_side,body,created_at')
    .single();
  if (error) throw new Error(describeUnknownError(error, 'Could not send platform message.'));
  return mapMessage(data as Record<string, unknown>);
}

export async function savePlatformChatReadMarker(organizationId: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase.from('platform_chat_read_markers').upsert({ user_id: userData.user.id, organization_id: organizationId, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,organization_id' });
}

export function subscribeToPlatformVenueMessages(organizationId: string, onMessage: (message: PlatformVenueMessage) => void): () => void {
  const supabase = requireSupabase();
  const channel = supabase.channel(`platform-venue-chat-${organizationId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_venue_messages', filter: `organization_id=eq.${organizationId}` }, (payload) => onMessage(mapMessage(payload.new as Record<string, unknown>)))
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
