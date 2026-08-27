import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listPlatformVenueMessages, savePlatformChatReadMarker, sendPlatformVenueMessage, subscribeToPlatformVenueMessages, type PlatformVenueMessage } from '../services/platform/platformChatService';
import { describeUnknownError } from '../utils/unknownError';

interface PlatformVenueChatPanelProps {
  organizationId?: string;
  organizationName?: string;
  senderSide?: 'platform' | 'venue';
  inline?: boolean;
}

export default function PlatformVenueChatPanel({ organizationId, organizationName = 'venue', senderSide = 'venue', inline = false }: PlatformVenueChatPanelProps) {
  const { user, organizationId: activeOrganizationId } = useAuth();
  const effectiveOrganizationId = organizationId || activeOrganizationId || '';
  const [messages, setMessages] = useState<PlatformVenueMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!effectiveOrganizationId) {
      setMessages([]);
      setError('');
      setLoading(false);
      return;
    }
    try {
      setError('');
      setMessages(await listPlatformVenueMessages(effectiveOrganizationId, senderSide));
      void savePlatformChatReadMarker(effectiveOrganizationId, senderSide);
    } catch (err) {
      setError(describeUnknownError(err, 'Could not load platform chat.'));
    } finally {
      setLoading(false);
    }
  }, [effectiveOrganizationId, senderSide]);

  useEffect(() => {
    void load();
    if (!effectiveOrganizationId) return;
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToPlatformVenueMessages(effectiveOrganizationId, (message) => {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
        void savePlatformChatReadMarker(effectiveOrganizationId, senderSide);
      }, senderSide);
    } catch {
      // Realtime is optional; polling keeps the chat usable.
    }
    const poll = window.setInterval(() => { void load(); }, 10000);
    return () => { unsubscribe(); window.clearInterval(poll); };
  }, [load, effectiveOrganizationId, senderSide]);

  if (!effectiveOrganizationId) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Select an active venue workspace to use platform chat.</div>;
  }

  const send = async () => {
    if (!draft.trim()) return;
    try {
      const message = await sendPlatformVenueMessage(effectiveOrganizationId, draft, senderSide);
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setDraft('');
    } catch (err) {
      setError(describeUnknownError(err, 'Could not send platform message.'));
    }
  };

  return (
    <div className={`${inline ? '' : 'rounded-2xl border border-gray-200 bg-white shadow-xl'} flex min-h-[420px] flex-col overflow-hidden`}>
      <div className="border-b border-gray-200 bg-indigo-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Platform ↔ venue</p>
        <h2 className="mt-1 text-base font-bold text-gray-900">Chat with {organizationName}</h2>
        <p className="mt-0.5 text-xs text-gray-600">Only platform administrators and active members of this venue can access this thread.</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4">
        {loading ? <p className="text-center text-xs text-gray-500">Loading chat…</p> : messages.length === 0 ? <p className="py-10 text-center text-xs text-gray-500">No platform messages yet.</p> : messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${message.senderSide === senderSide ? 'ml-auto bg-indigo-700 text-white' : 'bg-white text-gray-800 border border-gray-200'}`}><div className="mb-1 text-[10px] font-bold uppercase opacity-70">{message.senderSide === 'platform' ? 'Platform' : 'Venue'} · {new Date(message.createdAt).toLocaleString()}</div><div>{message.body}</div></div>)}
      </div>
      {error && <p role="alert" className="border-t border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="flex gap-2 border-t border-gray-200 bg-white p-3"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void send(); }} placeholder={`Message ${organizationName}…`} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" aria-label={`Platform chat with ${organizationName}`} /><button type="button" onClick={() => void send()} disabled={!draft.trim() || !user} className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Send</button></div>
    </div>
  );
}
