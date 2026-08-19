import { useEffect, useState } from 'react';
import type { Config } from '../config';
import { LoginScreen } from './LoginScreen';
import { getPublicPlatformBranding } from '../services/platform/platformBrandingService';

export const defaultPlatformConfig: Config = {
  logoUrl: '',
  venueName: 'Wedding Venue Intelligence Platform',
  tagline: 'Platform administration and venue operations',
  location: '',
  websiteUrl: '',
  supportEmail: '',
  phone: '',
  primaryColor: '#26354A',
  primaryDark: '#182436',
  primaryLight: '#3E5875',
  accentColor: '#6B8DB3',
  backgroundColor: '#F4F7FA',
  textColor: '#1F2937',
  headerTextColor: '#FFFFFF',
  bodyTextColor: '#334155',
  accentTextColor: '#26354A',
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  welcomeLogoUrl: '',
  welcomeTitle: 'Platform administration',
  showWelcomeByDefault: false,
  welcomeFeatures: ['Venue organizations', 'Managed administrators', 'Tenant health', 'Secure onboarding'],
  loginBackgroundType: 'gradient',
  loginBackgroundColor: '#F4F7FA',
  loginBackgroundSecondaryColor: '#E7EEF7',
  loginBackgroundAnimation: 'none',
  loginBackgroundOverlayOpacity: 0,
};

export default function PlatformLoginScreen() {
  const [branding, setBranding] = useState<Config>(defaultPlatformConfig);

  useEffect(() => {
    void getPublicPlatformBranding().then((next) => setBranding({ ...defaultPlatformConfig, ...next }));
  }, []);

  return <LoginScreen brandingOverride={branding} loginScope="platform" showPublicPortalLinks={false} />;
}
