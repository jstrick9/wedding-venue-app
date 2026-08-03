import { useEffect, useRef, useState } from 'react';
import { acceptInvite } from '../services/org/inviteService';
import { getConfig } from '../config';

interface AcceptInviteProps {
  token: string;
  onDone: () => void;
}

/**
 * Accept an organization invite by token. Requires the user to be signed in
 * (rendered only in the authenticated area). On success it clears the invite
 * hash and reloads the workspace so the new org membership is reflected.
 */
export function AcceptInvite({ token, onDone }: AcceptInviteProps) {
  const config = getConfig();
  const [state, setState] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Accepting invite…');
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await acceptInvite(token);
      if (cancelled) return;
      if (res.ok) {
        setState('success');
        setMessage('You have joined the workspace. Reloading…');
        setTimeout(() => {
          if (!cancelled && !doneRef.current) {
            doneRef.current = true;
            onDone();
          }
        }, 1200);
      } else {
        setState('error');
        setMessage(res.error || 'Could not accept this invite.');
      }
    })();
    return () => { cancelled = true; };
  }, [token, onDone]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: config.backgroundColor }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="text-4xl mb-3">
          {state === 'processing' ? '⏳' : state === 'success' ? '🎉' : '⚠️'}
        </div>
        <h1 className="text-xl font-semibold" style={{ color: config.primaryColor }}>
          {state === 'success' ? 'Welcome to the workspace!' : state === 'error' ? 'Invite issue' : 'Accepting invite'}
        </h1>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        {state === 'error' && (
          <button
            type="button"
            onClick={onDone}
            className="mt-4 px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: config.primaryColor }}
          >
            Back to workspace
          </button>
        )}
      </div>
    </div>
  );
}
