import { useMemo, useRef, type DragEvent } from 'react';
import type { Config } from '../../types';
import {
  DEFAULT_NEW_INVITE_TTL_DAYS,
  DEFAULT_REISSUE_INVITE_TTL_DAYS,
  clampInviteTtlDays,
} from '../../utils/inviteTtl';
import { VENUE_ADMIN_INVITE_TAGS, insertTextAtCursor } from '../../utils/inviteTemplateTags';
import {
  DEFAULT_VENUE_ADMIN_INVITE_BODY,
  DEFAULT_VENUE_ADMIN_INVITE_SUBJECT,
  VENUE_ADMIN_SETUP_BUTTON_LABEL,
  applyVenueAdminInviteTemplate,
  buildVenueAdminInviteHtml,
} from '../../utils/venueAdminInviteEmail';

interface InviteEmailTemplateEditorProps {
  branding: Config;
  onChange: (next: Config) => void;
}

function insertIntoField(
  field: HTMLInputElement | HTMLTextAreaElement,
  current: string,
  tag: string,
): string {
  const start = field.selectionStart ?? current.length;
  const end = field.selectionEnd ?? start;
  const next = insertTextAtCursor(current, tag, start, end);
  const caret = start + tag.length;
  queueMicrotask(() => {
    field.focus();
    field.setSelectionRange(caret, caret);
  });
  return next;
}

export default function InviteEmailTemplateEditor({ branding, onChange }: InviteEmailTemplateEditorProps) {
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const newTtl = clampInviteTtlDays(branding.venueAdminInviteTtlDays, DEFAULT_NEW_INVITE_TTL_DAYS);
  const reissueTtl = clampInviteTtlDays(branding.venueAdminReissueTtlDays, DEFAULT_REISSUE_INVITE_TTL_DAYS);
  const previewUrl = 'https://weddingvip.vercel.app/?va=example#/venue-onboarding';
  const preview = useMemo(
    () => applyVenueAdminInviteTemplate(branding.venueAdminInviteSubject, branding.venueAdminInviteBody, {
      venueName: 'Hilltop Barn',
      inviteUrl: previewUrl,
      adminEmail: 'owner@example.com',
      expiresAt: `in ${newTtl} days`,
      platformName: branding.venueName || 'Platform',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
    }),
    [branding.venueAdminInviteSubject, branding.venueAdminInviteBody, branding.venueName, newTtl],
  );
  const previewHtml = useMemo(
    () => buildVenueAdminInviteHtml(preview.body, previewUrl, preview.subject),
    [preview.body, preview.subject],
  );

  const dropTag = (event: DragEvent<HTMLInputElement | HTMLTextAreaElement>, field: 'subject' | 'body') => {
    event.preventDefault();
    const tag = event.dataTransfer.getData('text/plain');
    if (!VENUE_ADMIN_INVITE_TAGS.some((item) => item.tag === tag)) return;
    const target = event.currentTarget;
    if (field === 'subject') onChange({ ...branding, venueAdminInviteSubject: insertIntoField(target as HTMLInputElement, branding.venueAdminInviteSubject || '', tag) });
    else onChange({ ...branding, venueAdminInviteBody: insertIntoField(target as HTMLTextAreaElement, branding.venueAdminInviteBody || '', tag) });
  };

  const clickTag = (tag: string) => {
    const active = document.activeElement;
    if (active === subjectRef.current && subjectRef.current) {
      onChange({ ...branding, venueAdminInviteSubject: insertIntoField(subjectRef.current, branding.venueAdminInviteSubject || '', tag) });
      return;
    }
    if (bodyRef.current) {
      onChange({ ...branding, venueAdminInviteBody: insertIntoField(bodyRef.current, branding.venueAdminInviteBody || '', tag) });
    }
  };

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
      <p className="text-xs font-bold text-indigo-950">Venue administrator invite email</p>
      <p className="mt-1 text-[11px] text-indigo-800">
        Onboard and reissue send this HTML email automatically from wedding-vip@outlook.com through Brevo.
        The {VENUE_ADMIN_SETUP_BUTTON_LABEL} button is the invite link. Drag a tag into the subject or body, or click a tag to insert it at the cursor.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block text-xs font-semibold text-gray-700">
          New invite lifetime (days)
          <input
            type="number"
            min={1}
            max={90}
            value={newTtl}
            onChange={(event) => onChange({ ...branding, venueAdminInviteTtlDays: clampInviteTtlDays(event.target.value, DEFAULT_NEW_INVITE_TTL_DAYS) })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-semibold text-gray-700">
          Reissue lifetime (days)
          <input
            type="number"
            min={1}
            max={90}
            value={reissueTtl}
            onChange={(event) => onChange({ ...branding, venueAdminReissueTtlDays: clampInviteTtlDays(event.target.value, DEFAULT_REISSUE_INVITE_TTL_DAYS) })}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Invite merge tags">
        {VENUE_ADMIN_INVITE_TAGS.map((item) => (
          <button
            key={item.tag}
            type="button"
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', item.tag)}
            onClick={() => clickTag(item.tag)}
            title={`Drag or click to insert ${item.tag}`}
            className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-indigo-800 hover:bg-indigo-50"
          >
            {item.label} {item.tag}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-xs font-semibold text-gray-700">
        Subject
        <input
          ref={subjectRef}
          value={branding.venueAdminInviteSubject || ''}
          onChange={(event) => onChange({ ...branding, venueAdminInviteSubject: event.target.value })}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dropTag(event, 'subject')}
          placeholder={DEFAULT_VENUE_ADMIN_INVITE_SUBJECT}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="mt-2 block text-xs font-semibold text-gray-700">
        Body
        <textarea
          ref={bodyRef}
          value={branding.venueAdminInviteBody || ''}
          onChange={(event) => onChange({ ...branding, venueAdminInviteBody: event.target.value })}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => dropTag(event, 'body')}
          placeholder={DEFAULT_VENUE_ADMIN_INVITE_BODY}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
          rows={8}
        />
      </label>
      <p className="mt-3 text-[11px] font-semibold text-gray-600">Email preview — this is the message the venue administrator receives</p>
      <p className="mt-1 text-[11px] font-semibold text-gray-800">Subject: {preview.subject}</p>
      <iframe
        title="Venue administrator invite email preview"
        sandbox=""
        srcDoc={previewHtml}
        className="mt-2 h-[420px] w-full rounded-lg border border-white bg-white"
      />
      <p className="mt-3 text-[11px] leading-relaxed text-indigo-900">
        One-time Brevo setup: create a free Brevo account, add wedding-vip@outlook.com as a sender and confirm the email,
        then save the API key as the <code className="rounded bg-white px-1">BREVO_API_KEY</code> secret on the send-email Edge Function and redeploy it.
      </p>
    </div>
  );
}
