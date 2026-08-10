// @ts-nocheck
import { useState } from 'react';
import type { AdminCommonProps } from './AdminTabTypes';
import { TableManagement } from './TableManagement';
import { ChairManagement } from './ChairManagement';
import { LinenManagement } from './LinenManagement';
import { useBrandingConfig } from '../../config';

type SubTab = 'tables' | 'chairs' | 'linens';

/**
 * Deep-merges the seating-related asset editors (Tables/Seating, Chairs, Linens)
 * into a single admin screen with internal sub-tabs. Spacing now lives under the
 * Layout Content category (moved out of Venues & Inventory). Each sub-tab hosts
 * its existing editor component unchanged, so data models and behavior are
 * preserved while the top-level navigation is consolidated.
 */
export function SeatingAndLinensManagement(props: AdminCommonProps) {
  const config = useBrandingConfig();
  const [sub, setSub] = useState<SubTab>('tables');

  const tabs: { id: SubTab; label: string; icon: string }[] = [
    { id: 'tables', label: 'Tables/Seating', icon: '🪑' },
    { id: 'chairs', label: 'Chairs', icon: '💺' },
    { id: 'linens', label: 'Linens', icon: '🎨' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = sub === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'btn-primary bg-[#4A1942] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
              style={active ? { backgroundColor: config.primaryColor || '#4A1942' } : undefined}
            >
              {t.icon} {t.label}
            </button>
          );
        })}
      </div>
      {sub === 'tables' && <TableManagement {...props} />}
      {sub === 'chairs' && <ChairManagement {...props} />}
      {sub === 'linens' && <LinenManagement {...props} />}
    </div>
  );
}
