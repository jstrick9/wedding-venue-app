import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getConfig } from '../../config';
import { createInvite } from '../../services/org/inviteService';
import { showToast } from '../Toast';

const ROLES = [
  { id: 'admin', label: 'Admin' },
  { id: 'planner', label: 'Planner' },
  { id: 'staff', label: 'Staff' },
] as const;

/**
 * Invite a team member (staff/planner/admin) into the current organization.
 * Uses the platform invite service — sends an email via the send-email edge
 * function in Supabase mode, and simulates locally otherwise.
 */
export function InviteMembers() {
  const { user, organizationId, isAdmin } = useAuth();
  const config = getConfig();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'planner' | 'staff'>('staff');
  const [inviteeName, setInviteeName] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ inviteUrl?: string } | null>(null);

  if (!isAdmin || !organizationId || !user) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Only an admin in an organization can send invites.
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      showToast('Please enter an email address.', 'warning');
      return;
    }
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
    if (res.error) showToast(res.error, 'info');
    showToast(`Invitation sent to ${trimmed}.`, 'success');
    setEmail('');
    setInviteeName('');
    setResult(res);
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
          workspace. They'll receive an email with a link to join.
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
          {isSending ? 'Sending invite…' : 'Send Invite'}
        </button>
      </form>

      {result?.inviteUrl && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium mb-1">Invitation link (local mode)</p>
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
          <p className="text-xs break-all mt-1">{result.inviteUrl}</p>
        </div>
      )}
    </div>
  );
}
