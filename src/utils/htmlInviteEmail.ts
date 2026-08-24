/** Shared HTML invite rendering used by the live preview and Brevo send. */

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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


