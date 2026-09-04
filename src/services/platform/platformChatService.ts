import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import type { AuthSurface } from '../../utils/authSurface';
import { describeUnknownError } from '../../utils/unknownError';

export type PlatformChatSide = 'platform' | 'venue';

export interface PlatformVenueMessage {
  id: string;
  organizationId: string;
  senderUserId: string;
  senderSide: PlatformChatSide;
  body: string;
  createdAt: string;
}

export function chatAuthSurface(senderSide: PlatformChatSide): AuthSurface {
  return senderSide === 'venue' ? 'venue' : 'platform';
}

function requireChatClient(surface: AuthSurface) {
  if (!isSupabaseConfigured()) throw new Error('This service is temporarily unavailable.');
  return getSupabaseClient(surface);
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

export async function listPlatformVenueMessages(
  organizationId: string,
  senderSide: PlatformChatSide = 'platform',
): Promise<PlatformVenueMessage[]> {
  if (!organizationId) return [];
  const { data, error } = await requireChatClient(chatAuthSurface(senderSide))
    .from('platform_venue_messages')
    .select('id,organization_id,sender_user_id,sender_side,body,created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(describeUnknownError(error, 'Could not load platform chat.'));
  return (data || []).map((row) => mapMessage(row as Record<string, unknown>));
}

export async function sendPlatformVenueMessage(
  organizationId: string,
  body: string,
  senderSide: PlatformChatSide,
): Promise<PlatformVenueMessage> {
  const surface = chatAuthSurface(senderSide);
  const supabase = requireChatClient(surface);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error(
      surface === 'venue'
        ? 'Sign in at the venue login to send platform chat from this workspace. Platform administration uses a separate login.'
        : 'Sign in at Platform login to send this message. A venue invite account in this browser is separate.',
    );
  }
  const { data, error } = await supabase
    .from('platform_venue_messages')
    .insert({ organization_id: organizationId, sender_user_id: userData.user.id, sender_side: senderSide, body: body.trim() })
    .select('id,organization_id,sender_user_id,sender_side,body,created_at')
    .single();
  if (error) throw new Error(describeUnknownError(error, 'Could not send platform message.'));
  return mapMessage(data as Record<string, unknown>);
}

export async function savePlatformChatReadMarker(
  organizationId: string,
  senderSide: PlatformChatSide = 'platform',
): Promise<void> {
  const supabase = requireChatClient(chatAuthSurface(senderSide));
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  await supabase.from('platform_chat_read_markers').upsert({ user_id: userData.user.id, organization_id: organizationId, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,organization_id' });
}

export function subscribeToPlatformVenueMessages(
  organizationId: string,
  onMessage: (message: PlatformVenueMessage) => void,
  senderSide: PlatformChatSide = 'platform',
): () => void {
  const supabase = requireChatClient(chatAuthSurface(senderSide));
  const channel = supabase.channel(`platform-venue-chat-${organizationId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_venue_messages', filter: `organization_id=eq.${organizationId}` }, (payload) => onMessage(mapMessage(payload.new as Record<string, unknown>)))
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
