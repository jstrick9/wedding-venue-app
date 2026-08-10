/**
 * Seven Paths Manor - Layout Planner Configuration
 *
 * Easy configuration for branding and customization.
 * These values can be updated via the Admin Panel or directly here.
 */

import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from './constants/storageKeys';
import { STORAGE_VERSIONS } from './constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from './utils/storage';
import { on, emitDataChanged } from './utils/appEvents';
import type { Config } from './types';

const CONFIG_STORAGE_KEY = STORAGE_KEYS.CONFIG;
const CONFIG_STORAGE_VERSION = STORAGE_VERSIONS.CONFIG;

// The `Config` interface is defined once in `src/types.ts` and re-exported
// here so that `import { Config } from '../config'` and
// `import { Config } from '../../types'` resolve to the same type. Keeping two
// copies in sync was a maintainability hazard.
export type { Config };

// Default configuration
export const defaultConfig: Config = {
  logoUrl: '',
  venueName: 'Seven Paths Manor',
  tagline: 'Affordable Luxury - Weddings Reimagined',
  location: 'Spring Hope, NC',
  websiteUrl: 'https://www.sevenpathsmanor.com',
  supportEmail: 'weddings@sevenpathsmanor.com',
  phone: '',

  primaryColor: '#4A1942',
  primaryDark: '#3d1a45',
  primaryLight: '#6b2c5c',
  accentColor: '#8B5A8B',
  backgroundColor: '#f3f4f6',
  textColor: '#1f2937',

  fontFamily: 'Inter, system-ui, sans-serif',
  headingFontFamily: 'Inter, system-ui, sans-serif',
  headerTextColor: '#FFFFFF',
  bodyTextColor: '#374151',
  accentTextColor: '#4A1942',

  welcomeLogoUrl: '',
  welcomeTitle: 'Welcome to the Wedding Venue Layout Planner',
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

function readEnvString(name: string): string | undefined {
  const value = import.meta.env?.[name as keyof ImportMetaEnv];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readEnvBoolean(name: string): boolean | undefined {
  const value = import.meta.env?.[name as keyof ImportMetaEnv];
  if (typeof value !== 'string') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function getRuntimeDefaultConfig(): Config {
  return {
    ...defaultConfig,
    primaryColor:
      readEnvString('VITE_BRANDING_PRIMARY_COLOR') ?? defaultConfig.primaryColor,
    showWelcomeByDefault:
      readEnvBoolean('VITE_SHOW_WELCOME_BY_DEFAULT') ??
      defaultConfig.showWelcomeByDefault,
  };
}

export function getConfig(): Config {
  try {
    return loadVersionedStorage<Config>({
      key: CONFIG_STORAGE_KEY,
      defaultValue: getRuntimeDefaultConfig(),
      currentVersion: CONFIG_STORAGE_VERSION,
      migrations: {
        0: (input) => ({ ...getRuntimeDefaultConfig(), ...(input as Partial<Config>) }),
      },
      normalize: (value) => ({ ...getRuntimeDefaultConfig(), ...value }),
    });
  } catch (e) {
    console.error('Failed to load config:', e);
    return getRuntimeDefaultConfig();
  }
}

const LOADED_FONT_FAMILIES = new Set(['Inter', 'Playfair Display']);

function loadGoogleFont(fontStack?: string): void {
  if (typeof document === 'undefined' || !fontStack) return;
  const match = fontStack.match(/^['"]?([^'",]+)['"]?/);
  if (!match) return;
  const family = match[1].trim();
  if (!family || LOADED_FONT_FAMILIES.has(family)) return;
  const systemFonts = ['system-ui', 'sans-serif', 'serif', 'monospace', 'Arial', 'Georgia'];
  if (systemFonts.includes(family)) return;
  LOADED_FONT_FAMILIES.add(family);
  const id = `spm-google-font-${family.toLowerCase().replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

export function applyRootStyles(config: Partial<Config>): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const primary = config.primaryColor || '#4A1942';
  const dark = config.primaryDark || '#3d1a45';
  const light = config.primaryLight || '#6b2c5c';

  root.style.setProperty('--primary-color', primary);
  root.style.setProperty('--primary-dark', dark);
  root.style.setProperty('--primary-light', light);

  // Map legacy --color-plum-* variables to the active brand theme
  root.style.setProperty('--color-plum-900', dark);
  root.style.setProperty('--color-plum-800', dark);
  root.style.setProperty('--color-plum-700', primary);
  root.style.setProperty('--color-plum-600', light);
  root.style.setProperty('--color-plum-500', light);
  root.style.setProperty('--color-plum-400', primary);
  root.style.setProperty('--color-plum-300', light);
  root.style.setProperty('--color-plum-200', `color-mix(in srgb, ${primary} 25%, transparent)`);
  root.style.setProperty('--color-plum-100', `color-mix(in srgb, ${primary} 12%, transparent)`);
  root.style.setProperty('--color-plum-50', `color-mix(in srgb, ${primary} 6%, transparent)`);

  if (config.accentColor) root.style.setProperty('--accent-color', config.accentColor);
  if (config.backgroundColor) root.style.setProperty('--background-color', config.backgroundColor);
  if (config.textColor) root.style.setProperty('--text-color', config.textColor);
  if (config.fontFamily) {
    loadGoogleFont(config.fontFamily);
    root.style.setProperty('--font-family', config.fontFamily);
  }
  if (config.headingFontFamily) {
    loadGoogleFont(config.headingFontFamily);
    root.style.setProperty('--heading-font-family', config.headingFontFamily);
  }
  if (config.headerTextColor) root.style.setProperty('--header-text-color', config.headerTextColor);
  if (config.bodyTextColor) root.style.setProperty('--body-text-color', config.bodyTextColor);
  if (config.accentTextColor) root.style.setProperty('--accent-text-color', config.accentTextColor);
}

export function updateConfig(config: Partial<Config>): void {
  try {
    const current = getConfig();
    const updated = { ...current, ...config };
    saveVersionedStorage(CONFIG_STORAGE_KEY, CONFIG_STORAGE_VERSION, updated);
    applyRootStyles(updated);
    emitDataChanged('all');
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

export function setConfig(config: Config): void {
  try {
    saveVersionedStorage(CONFIG_STORAGE_KEY, CONFIG_STORAGE_VERSION, config);
    applyRootStyles(config);
    emitDataChanged('all');
  } catch (e) {
    console.error('Failed to save config:', e);
  }
}

export function resetConfig(): void {
  localStorage.removeItem(CONFIG_STORAGE_KEY);
  applyRootStyles(getConfig());
  emitDataChanged('all');
}

export function useBrandingConfig(): Config {
  const [config, setConfigState] = useState<Config>(() => {
    const initial = getConfig();
    applyRootStyles(initial);
    return initial;
  });

  useEffect(() => {
    const handleUpdate = () => {
      const next = getConfig();
      setConfigState(next);
      applyRootStyles(next);
    };
    const offDataChanged = on('spm_data_changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      offDataChanged();
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return config;
}

const CONFIG = getConfig();
export default CONFIG;