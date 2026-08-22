import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getConfig } from '../../config';
import { createInvite } from '../../services/org/inviteService';
import { showToast } from '../Toast';
import { normalizeEmail } from '../../utils/contactQuality';
import { OUTLOOK_INVITE_FROM, openOutlookInviteCompose, type InviteComposeMessage } from '../../utils/inviteCompose';
import { buildHtmlInviteDocument, inviteEmlFilename } from '../../utils/htmlInviteEmail';

const ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'planner', label: 'Planner' },
  { id: 'staff', label: 'Staff' },
] as const;

/**
 * Invite a team member (staff/planner/admin) into the current organization.
 * Uses the platform invite service. The operator emails the HTML invite
 * with Send with Outlook (ready-to-send .eml draft).
 */
export function InviteMembers() {
  const { user, organizationId, isAdmin } = useAuth();
  const config = getConfig();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'planner' | 'staff'>('staff');
  const [inviteeName, setInviteeName] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ inviteUrl?: string; compose?: InviteComposeMessage | null } | null>(null);

  if (!isAdmin || !organizationId || !user) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Only an admin in an organization can send invites.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeEmail(email, { required: true });
    if (!normalized.ok) {
      showToast(normalized.error || 'Please enter an email address.', 'warning');
      return;
    }
    const trimmed = normalized.value;
    setIsSending(true);
    setResult(null);
    const res = await createInvite({
      organizationId,
      inviterUserId: user.id,
      email: trimmed,
      role,
      organizationName: config.venueName || 'your venue',
      inviteeName: inviteeName.trim() || undefined,
    });
    setIsSending(false);

    if (!res.ok) {
      showToast(res.error || 'Could not send the invite.', 'warning');
      return;
    }
    const greetingName = inviteeName.trim();
    const subject = `You are invited to ${config.venueName || 'the venue workspace'}`;
    const body = [
      `Hello${greetingName ? ` ${greetingName}` : ''},`,
      '',
      `You have been invited to join ${config.venueName || 'the venue workspace'} as ${role}.`,
      '',
      'Use the button in this email to accept the invitation.',
    ].join('\n');
    const compose = res.inviteUrl
      ? {
          to: trimmed,
          subject,
          body: `${body}\n\nOpen invitation:\n${res.inviteUrl}`,
          html: buildHtmlInviteDocument({
            subject,
            body,
            buttonUrl: res.inviteUrl,
            buttonLabel: 'Open invitation',
          }),
          filename: inviteEmlFilename(`invite-${config.venueName || 'venue'}`),
        }
      : null;
    showToast(`Invitation created for ${trimmed}. Click Send with Outlook to email the HTML invite.`, 'success');
    setEmail('');
    setInviteeName('');
    setResult({ ...res, compose });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">📨</span>
          <h3 className="font-semibold text-gray-800">Invite a team member</h3>
        </div>
        <p className="text-sm text-gray-500">
          Invite a planner, coordinator, or staff member to collaborate in this
          workspace. Create the invitation, then send the HTML email from Outlook.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRole(r.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  role === r.id
                    ? 'bg-[#4A1942] text-white border-[#4A1942]'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Their name (optional)</label>
          <input
            type="text"
            value={inviteeName}
            onChange={(e) => setInviteeName(e.target.value)}
            placeholder="Alex Smith"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={isSending}
          className="w-full rounded-lg text-white text-sm font-medium disabled:opacity-60 py-2.5"
          style={{ backgroundColor: config.primaryColor }}
        >
          {isSending ? 'Creating invite…' : 'Create invitation'}
        </button>
      </form>

      {result?.inviteUrl && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium mb-1">Invitation link</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(result.inviteUrl!).then(
                  () => showToast('Invitation link copied to clipboard.', 'success'),
                  () => showToast('Copy failed — copy the link below.', 'warning'),
                );
              }}
              className="shrink-0 rounded-lg border border-green-300 bg-white px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
            >
              📋 Copy
            </button>
          </div>
          {result.compose ? (
            <button
              type="button"
              onClick={() => {
                openOutlookInviteCompose(result.compose!);
                showToast('HTML invite downloaded. Open the .eml file in Outlook and click Send.', 'success');
              }}
              className="mt-2 rounded-lg border border-green-300 bg-white px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
            >
              Send with Outlook ({OUTLOOK_INVITE_FROM})
            </button>
          ) : null}
          <p className="text-xs break-all mt-1">{result.inviteUrl}</p>
        </div>
      )}
    </div>
  );
}
