import React from 'react';
import { Config } from '../../config';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';

interface BrandingManagementProps {
  config: Config;
  onSaveConfig: (config: Config) => void;
  expandedSections: Set<string>;
  onToggleSection: (key: string) => void;
}

export function BrandingManagement({ config, onSaveConfig, expandedSections, onToggleSection }: BrandingManagementProps) {
  return (
    <div className="space-y-4">
      <BrandedSectionHeader icon="🎨" title="Branding" description="Customize colors, fonts, and appearance" config={config} />

      <div className="bg-white p-6 rounded-xl border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium">Primary Color</label>
            <input type="color" value={config.primaryColor} onChange={(e) => onSaveConfig({ ...config, primaryColor: e.target.value })} className="w-full h-10" />
          </div>
          <div>
            <label className="text-xs font-medium">Accent Color</label>
            <input type="color" value={config.accentColor} onChange={(e) => onSaveConfig({ ...config, accentColor: e.target.value })} className="w-full h-10" />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-medium">Venue Name</label>
          <input type="text" value={config.venueName} onChange={(e) => onSaveConfig({ ...config, venueName: e.target.value })} className="w-full border rounded px-3 py-2" />
        </div>
      </div>
    </div>
  );
}