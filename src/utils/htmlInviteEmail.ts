/** Shared HTML invite rendering and Outlook-ready .eml drafts. */

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function inviteEmlFilename(label: string): string {
  const slug = (label || 'invite')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'invite'}.eml`;
}

export function renderEmailCtaButton(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return [
    '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px;">',
    '<tr>',
    '<td align="center" bgcolor="#4A1942" style="border-radius:8px;">',
    `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">${safeLabel}</a>`,
    '</td>',
    '</tr>',
    '</table>',
  ].join('');
}

export function paragraphsToHtml(text: string): string {
  const trimmed = text.replace(/\r\n/g, '\n').trim();
  if (!trimmed) return '';
  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1f2937;">${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

export function wrapInviteHtml(subject: string, innerHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
          <tr>
            <td style="padding:32px 28px;">
              ${innerHtml}
              <p style="margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6b7280;">This message was sent by your wedding venue planning workspace.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildHtmlInviteDocument(input: {
  subject: string;
  body: string;
  buttonUrl: string;
  buttonLabel: string;
}): string {
  const bodyWithoutUrl = input.buttonUrl
    ? input.body.split(input.buttonUrl).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    : input.body;
  return wrapInviteHtml(input.subject, `${paragraphsToHtml(bodyWithoutUrl)}${renderEmailCtaButton(input.buttonUrl, input.buttonLabel)}`);
}

function encodeMimeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const bytes = unescape(encodeURIComponent(value));
  return `=?UTF-8?B?${btoa(bytes)}?=`;
}

export interface UnsentHtmlEmlInput {
  from: string;
  fromLabel?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function buildUnsentHtmlEml(input: UnsentHtmlEmlInput): string {
  const boundary = `wvip-${Math.random().toString(36).slice(2, 12)}`;
  const from = input.fromLabel
    ? `${encodeMimeHeader(input.fromLabel)} <${input.from}>`
    : input.from;
  const headers = [
    'MIME-Version: 1.0',
    'X-Unsent: 1',
    `From: ${from}`,
    `To: ${input.to.trim()}`,
    `Subject: ${encodeMimeHeader(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    input.html.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'),
    `--${boundary}--`,
    '',
  ];
  return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

export function downloadUnsentHtmlEml(input: UnsentHtmlEmlInput & { filename?: string }): string {
  const filename = input.filename || inviteEmlFilename(input.subject);
  if (typeof document === 'undefined') return filename;
  const blob = new Blob([buildUnsentHtmlEml(input)], { type: 'message/rfc822' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return filename;
}
