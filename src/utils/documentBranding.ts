const DEFAULT_TAB_TITLE = 'Wedding Venue Intelligence Platform';
const DEFAULT_TAB_COLOR = '#26354A';
const APPLE_TITLE_META = 'apple-mobile-web-app-title';

export interface DocumentBranding {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  suffix?: string | null;
}

export function formatDocumentTitle(name?: string | null, suffix?: string | null): string {
  const n = String(name || '').trim();
  const s = String(suffix || '').trim();
  if (n && s && n !== s) return `${n} | ${s}`;
  return n || s || DEFAULT_TAB_TITLE;
}

export function safeHexColor(value?: string | null, fallback = DEFAULT_TAB_COLOR): string {
  const trimmed = String(value || '').trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : fallback;
}

export function safeLogoHref(url?: string | null): string | null {
  const trimmed = String(url || '').trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return null;
}

export function letterFaviconHref(name?: string | null, primaryColor?: string | null): string {
  const match = String(name || '').trim().match(/[A-Za-z0-9]/);
  const letter = (match?.[0] || 'W').toUpperCase();
  const fill = safeHexColor(primaryColor);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${fill}"/><text x="32" y="42" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="32" font-weight="700" fill="white">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function upsertLink(rel: string, href: string, extra?: { type?: string; id?: string }): void {
  if (typeof document === 'undefined') return;
  const selector = extra?.id ? `#${extra.id}` : `link[rel="${rel}"]`;
  let link = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    if (extra?.id) link.id = extra.id;
    document.head.appendChild(link);
  }
  link.rel = rel;
  if (extra?.type) link.type = extra.type;
  else link.removeAttribute('type');
  link.href = href;
}

function upsertMeta(name: string, content: string): void {
  if (typeof document === 'undefined') return;
  let meta = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = name;
    document.head.appendChild(meta);
  }
  meta.content = content;
}

/** Browser tab title, favicon, and theme color from the active surface branding. */
export function applyDocumentBranding(branding: DocumentBranding = {}): void {
  if (typeof document === 'undefined') return;
  const title = formatDocumentTitle(branding.name, branding.suffix);
  document.title = title;

  const favicon = safeLogoHref(branding.logoUrl) || letterFaviconHref(branding.name, branding.primaryColor);
  upsertLink('icon', favicon);
  upsertLink('shortcut icon', favicon);
  upsertLink('apple-touch-icon', favicon, { id: 'spm-apple-touch-icon' });

  const color = safeHexColor(branding.primaryColor);
  upsertMeta('theme-color', color);
  upsertMeta(APPLE_TITLE_META, String(branding.name || '').trim() || DEFAULT_TAB_TITLE);
}
