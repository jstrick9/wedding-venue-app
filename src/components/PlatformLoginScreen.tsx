import { useEffect, useState } from 'react';
import type { Config } from '../config';
import { LoginScreen } from './LoginScreen';
import { getPublicPlatformBranding } from '../services/platform/platformBrandingService';
import { DEFAULT_PLATFORM_LOGIN_CONFIG, applyLoginBranding } from '../utils/loginBranding';
import { withTimeout } from '../utils/withTimeout';

export const defaultPlatformConfig: Config = DEFAULT_PLATFORM_LOGIN_CONFIG;

export default function PlatformLoginScreen() {
  const [branding, setBranding] = useState<Config>(defaultPlatformConfig);

  useEffect(() => {
    applyLoginBranding(defaultPlatformConfig);
    let cancelled = false;
    void (async () => {
      try {
        const next = await withTimeout(
          getPublicPlatformBranding(),
          20000,
          'Loading platform branding timed out.',
        );
        if (cancelled) return;
        const merged = { ...defaultPlatformConfig, ...next };
        setBranding(merged);
        applyLoginBranding(merged);
      } catch {
        // Keep default navy chrome. The sign-in form is already visible.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <LoginScreen brandingOverride={branding} loginScope="platform" showPublicPortalLinks={false} />;
}
