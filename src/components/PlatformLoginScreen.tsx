import { useEffect, useState } from 'react';
import type { Config } from '../config';
import { LoginScreen } from './LoginScreen';
import { getPublicPlatformBranding } from '../services/platform/platformBrandingService';
import { DEFAULT_PLATFORM_LOGIN_CONFIG, applyLoginBranding } from '../utils/loginBranding';

export const defaultPlatformConfig: Config = DEFAULT_PLATFORM_LOGIN_CONFIG;

export default function PlatformLoginScreen() {
  const [branding, setBranding] = useState<Config>(defaultPlatformConfig);

  useEffect(() => {
    applyLoginBranding(defaultPlatformConfig);
    void getPublicPlatformBranding().then((next) => {
      const merged = { ...defaultPlatformConfig, ...next };
      setBranding(merged);
      applyLoginBranding(merged);
    });
  }, []);

  return <LoginScreen brandingOverride={branding} loginScope="platform" showPublicPortalLinks={false} />;
}
