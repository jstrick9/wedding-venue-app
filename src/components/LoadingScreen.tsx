import { Logo } from './Logo';
import { getConfig } from '../config';

/**
 * Branded loading screen used as the app's Suspense fallback. Replaces the bare
 * "Loading..." text with the venue logo + a themed spinner for a polished first
 * impression while lazy chunks load.
 */
export function LoadingScreen({ label = 'Loading' }: { label?: string }) {
  const config = getConfig();
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-[#f8f5f7]">
      <div className="flex items-center justify-center gap-3">
        <Logo url={config.logoUrl} size="lg" />
      </div>
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200"
        style={{ borderTopColor: config.primaryColor }}
      />
      <p className="text-sm text-gray-500">{label}…</p>
    </div>
  );
}
