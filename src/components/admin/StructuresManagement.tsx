// @ts-nocheck
import { useState } from 'react';
import type { AdminCommonProps } from './AdminTabTypes';
import { FixtureManagement } from './FixtureManagement';
import { WallManagement } from './WallManagement';

type SubTab = 'fixtures' | 'walls';

/**
 * Deep-merges the structural asset editors (Fixtures, Walls) into a single admin
 * screen with internal sub-tabs. Each sub-tab hosts its existing editor component
 * unchanged, so data models and behavior are preserved while the top-level
 * navigation is consolidated.
 */
export function StructuresManagement(props: AdminCommonProps) {
  const [sub, setSub] = useState<SubTab>('fixtures');

  const tabs: { id: SubTab; label: string; icon: string }[] = [
    { id: 'fixtures', label: 'Fixtures', icon: '📦' },
    { id: 'walls', label: 'Walls', icon: '🪟' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              sub === t.id
                ? 'bg-[#4A1942] text-white'
                : 'bg-white border border-gray-200 text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {sub === 'fixtures' && <FixtureManagement {...props} />}
      {sub === 'walls' && <WallManagement {...props} />}
    </div>
  );
}
