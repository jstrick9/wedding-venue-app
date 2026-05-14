import React from 'react';
import { Config } from '../../config';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';

interface SpacingSettings {
  minTableSpacing: number;
  minWallSpacing: number;
  minFixtureSpacing: number;
  minItemSpacing: number;
  enableCollisionDetection: boolean;
}

interface SpacingManagementProps {
  spacingSettings: SpacingSettings;
  config: Config;
  onSaveSpacing: (settings: SpacingSettings) => void;
}

export function SpacingManagement({ spacingSettings, config, onSaveSpacing }: SpacingManagementProps) {
  const update = (key: keyof SpacingSettings, value: any) => {
    onSaveSpacing({ ...spacingSettings, [key]: value });
  };

  return (
    <div className="space-y-6">
      <BrandedSectionHeader icon="📐" title="Spacing & Collision" description="Configure minimum spacing rules" config={config} />

      <div className="bg-white p-5 rounded-xl border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-bold">Collision Detection</h4>
            <p className="text-sm text-gray-500">Prevent items from overlapping</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={spacingSettings.enableCollisionDetection} onChange={(e) => update('enableCollisionDetection', e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#4A1942]"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { key: 'minTableSpacing', label: 'Table to Table (ft)', min: 0, max: 10 },
            { key: 'minWallSpacing', label: 'Wall Spacing (ft)', min: 0, max: 8 },
            { key: 'minFixtureSpacing', label: 'Fixture Spacing (ft)', min: 1, max: 12 },
            { key: 'minItemSpacing', label: 'General Item Spacing (ft)', min: 0, max: 6 },
          ].map(({ key, label, min, max }) => (
            <div key={key} className="bg-gray-50 p-4 rounded-lg">
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">{label}</span>
                <span className="font-bold text-[#4A1942]">{(spacingSettings as any)[key]} ft</span>
              </div>
              <input
                type="range"
                min={min}
                max={max}
                step="0.5"
                value={(spacingSettings as any)[key]}
                onChange={(e) => update(key as any, parseFloat(e.target.value))}
                className="w-full accent-[#4A1942]"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}