import type { Config } from '../config';
import { LoginScreen } from './LoginScreen';

const platformConfig: Config = {
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
};

export default function PlatformLoginScreen() {
  return <LoginScreen brandingOverride={platformConfig} loginScope="platform" showPublicPortalLinks={false} />;
}
