import { getPlatformProvider } from '../platform';
import { getSupabaseClient, isSupabaseConfigured } from '../backend/supabaseClient';
import { createOpaqueToken } from '../../utils/secureTokens';
import { STORAGE_KEYS } from '../../constants/storageKeys';

/**
 * Organization invite service.
 *
 * Owners/admins invite staff/planners into their organization. The invite is
 * persisted as a hashed token in `org_invites`. The operator emails it with
 * Send with Outlook (HTML .eml draft). Accepting the invite calls the
 * `accept_invite` RPC which creates an active membership.
 *
 * Local mode: invites are recorded in localStorage so the feature is still
 * usable/testable without a backend.
 */

export interface InviteParams {
  organizationId: string;
  inviterUserId: string;
  email: string;
  role: 'owner' | 'admin' | 'planner' | 'staff';
  organizationName: string;
  inviteeName?: string;
  appBaseUrl?: string;
}

export interface InviteResult {
  ok: boolean;
  error?: string;
  inviteUrl?: string;
}

const INVITES_KEY = STORAGE_KEYS.ORG_INVITES;

function localInvites(): Array<Record<string, unknown>> {
  try {
    return JSON.parse(localStorage.getItem(INVITES_KEY) || '[]');
  } catch {
    return [];
  }
}
function saveLocalInvites(list: Array<Record<string, unknown>>): void {
  localStorage.setItem(INVITES_KEY, JSON.stringify(list));
}

export async function createInvite(params: InviteParams): Promise<InviteResult> {
  const provider = getPlatformProvider();

  if (provider !== 'supabase' || !isSupabaseConfigured()) {
    // Local simulation: record the invite; no email is sent.
    const token = createOpaqueToken('invite');
    saveLocalInvites([...localInvites(), {
      email: params.email,
      role: params.role,
      organizationId: params.organizationId,
      token,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }]);
    const base = params.appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return { ok: true, inviteUrl: `${base}#/accept-invite/${token}` };
  }

  const supabase = getSupabaseClient();
  const token = crypto.getRandomValues ? (() => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  })() : `invite-${Date.now().toString(36)}`;
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from('org_invites').insert({
    organization_id: params.organizationId,
    email: params.email,
    role: params.role,
    token_hash: tokenHash,
    status: 'pending',
    expires_at: expiresAt,
    created_by: params.inviterUserId,
  });
  if (error) return { ok: false, error: error.message };

  const base = params.appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const inviteUrl = `${base}#/accept-invite/${token}`;
  return { ok: true, inviteUrl };
}

export async function acceptInvite(token: string): Promise<InviteResult> {
  const provider = getPlatformProvider();

  if (provider !== 'supabase' || !isSupabaseConfigured()) {
    // Local simulation: mark matching local invite accepted.
    const list = localInvites();
    const found = list.find((i) => i.token === token && i.status === 'pending');
    if (!found) return { ok: false, error: 'Invite not found or already used.' };
    const next = list.map((i) => (i.token === token ? { ...i, status: 'accepted' } : i));
    saveLocalInvites(next);
    return { ok: true };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('accept_invite', { p_token: token });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error || 'Could not accept invite.' };
  return { ok: true };
}

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
