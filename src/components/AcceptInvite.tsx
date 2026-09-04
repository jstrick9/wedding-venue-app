import { useEffect, useRef, useState } from 'react';
import { acceptInvite } from '../services/org/inviteService';
import { getConfig } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { resolveLoginChrome } from '../utils/loginBranding';
import { withTimeout } from '../utils/withTimeout';
import { describeUnknownError } from '../utils/unknownError';

interface AcceptInviteProps {
  token: string;
  onDone: () => void;
}

/**
 * Accept an organization invite by token. Requires the user to be signed in
 * (rendered only in the authenticated area). On success it refreshes the
 * AuthContext session so the new membership is reflected without a reload.
 */
export function AcceptInvite({ token, onDone }: AcceptInviteProps) {
  const config = getConfig();
  const chrome = resolveLoginChrome(config);
  const { refreshSession } = useAuth();
  const [state, setState] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Accepting invite…');
  const doneRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await withTimeout(
          acceptInvite(token),
          20000,
          'Accepting this invite timed out. Check your connection and try again.',
        );
        if (cancelled) return;
        if (res.ok) {
          try {
            await refreshSession();
          } catch {
            // Session refresh is best-effort; onDone still navigates home.
          }
          if (cancelled) return;
          setState('success');
          setMessage('You have joined the workspace.');
          setTimeout(() => {
            if (!cancelled && !doneRef.current) {
              doneRef.current = true;
              onDone();
            }
          }, 800);
        } else {
          setState('error');
          setMessage(describeUnknownError(new Error(res.error || ''), 'Could not accept this invite.'));
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setState('error');
        setMessage(describeUnknownError(err, 'Could not accept this invite.'));
      }
    })();
    return () => { cancelled = true; };
  }, [token, onDone, refreshSession]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: chrome.background, fontFamily: chrome.fontFamily }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="text-4xl mb-3">
          {state === 'processing' ? '⏳' : state === 'success' ? '🎉' : '⚠️'}
        </div>
        <h1 className="text-xl font-semibold" style={{ color: chrome.primary, fontFamily: chrome.headingFontFamily }}>
          {state === 'success' ? 'Welcome to the workspace!' : state === 'error' ? 'Invite issue' : 'Accepting invite'}
        </h1>
        <p className="text-sm text-gray-600 mt-2">{message}</p>
        {state === 'error' && (
          <button
            type="button"
            onClick={onDone}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: chrome.primary, color: chrome.headerText }}
          >
            Back to workspace
          </button>
        )}
      </div>
    </div>
  );
}
