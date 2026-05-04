/**
 * Seven Paths Manor - Layout Planner Configuration
 * 
 * Easy configuration for branding and customization.
 * These values can be updated via the Admin Panel or directly here.
 */

const CONFIG_STORAGE_KEY = 'spm_config';

export interface Config {
  // Branding
  logoUrl: string;
  venueName: string;
  tagline: string;
  location: string;
  websiteUrl: string;
  supportEmail: string;
  phone?: string;
  
  // Color Palette
  primaryColor: string;
  primaryDark: string;
  primaryLight: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  
  // Typography
  fontFamily: string;
  headingFontFamily: string;
  headerTextColor: string;
  bodyTextColor: string;
  accentTextColor: string;
  
  // Welcome Settings
  welcomeLogoUrl?: string;
  welcomeTitle?: string;
  showWelcomeByDefault?: boolean;
  /** Feature chips shown on welcome screen for non-admin users */
  welcomeFeatures?: string[];
}

// Default configuration
export const defaultConfig: Config = {
  // Logo - paste your image URL here
  logoUrl: '',
  
  // Venue Information
  venueName: 'Seven Paths Manor',
  tagline: 'Where Your Love Story Unfolds',
  location: 'Spring Hope, NC',
  websiteUrl: 'https://www.sevenpathsmanor.com',
  supportEmail: 'events@sevenpathsmanor.com',
  phone: '',
  
  // Color Palette - Deep Plum
  primaryColor: '#4A1942',
  primaryDark: '#3d1a45',
  primaryLight: '#6b2c5c',
  accentColor: '#8B5A8B',
  backgroundColor: '#f3f4f6',
  textColor: '#1f2937',
  
  // Typography
  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  headerTextColor: '#FFFFFF',
  bodyTextColor: '#374151',
  accentTextColor: '#4A1942',
  
  // Welcome Settings
  welcomeLogoUrl: '',
  welcomeTitle: 'Welcome to the Wedding Layout Planner',
  showWelcomeByDefault: true,
  welcomeFeatures: [
    'Layout Design',
    'Guest Management',
    'Templates',
    'Print & Share',
    'Event Questions',
    'Chat',
  ],
};

// Load config from localStorage
export function getConfig(): Config {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return defaultConfig;
}

// Save config to localStorage
export function updateConfig(config: Partial<Config>): void {
  try {
    const current = getConfig();
    const updated = { ...current, ...config };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

// Set full config (alias for AdminPanel compatibility)
export function setConfig(config: Config): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

// Reset config to defaults
export function resetConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
}

// Export the current config as default for backward compatibility
const CONFIG = getConfig();
export default CONFIG;
