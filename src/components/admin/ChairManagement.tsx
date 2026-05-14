import React from 'react';
import { ChairSpec } from '../../types';
import { Config } from '../../config';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';

interface ChairManagementProps {
  chairSpecs: ChairSpec[];
  config: Config;
  onSaveChairs: (chairs: ChairSpec[]) => void;
  expandedChairs: Set<string>;
  onToggleChair: (id: string) => void;
}

export function ChairManagement({ chairSpecs, config, onSaveChairs, expandedChairs, onToggleChair }: ChairManagementProps) {
  const activeChairs = chairSpecs.filter(c => c.id !== 'none');

  return (
    <div className="space-y-4">
      <BrandedSectionHeader icon="💺" title="Chair Types" description="Manage chair styles for tables and ceremonies" config={config} />

      <div className="flex justify-end">
        <button
          onClick={() => {
            const newChair: ChairSpec = {
              id: `chair-${Date.now()}` as any,
              name: 'New Chair',
              color: '#FFFFFF',
              width: 1.5,
              depth: 1.5,
              icon: '🪑'
            };
            onSaveChairs([...chairSpecs, newChair]);
          }}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg"
        >
          + Add Chair Type
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {activeChairs.map(chair => (
          <div key={chair.id} className="bg-white rounded-xl border p-4">
            <div className="flex justify-between cursor-pointer" onClick={() => onToggleChair(chair.id)}>
              <div className="flex items-center gap-3">
                <span>{expandedChairs.has(chair.id) ? '▼' : '▶'}</span>
                <div className="w-10 h-10 rounded flex items-center justify-center text-xl" style={{ backgroundColor: chair.color }}>
                  {chair.icon}
                </div>
                <span className="font-semibold">{chair.name}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onSaveChairs(chairSpecs.filter(c => c.id !== chair.id)); }} className="text-red-500">🗑️</button>
            </div>

            {expandedChairs.has(chair.id) && (
              <div className="mt-4 space-y-3">
                <input type="text" value={chair.name} onChange={(e) => onSaveChairs(chairSpecs.map(c => c.id === chair.id ? { ...c, name: e.target.value } : c))} className="w-full border rounded px-3 py-2" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs">Width</label>
                    <input type="number" value={chair.width} onChange={(e) => onSaveChairs(chairSpecs.map(c => c.id === chair.id ? { ...c, width: parseFloat(e.target.value) || 1.5 } : c))} className="w-full border rounded px-3 py-2" />
                  </div>
                  <div>
                    <label className="text-xs">Depth</label>
                    <input type="number" value={chair.depth} onChange={(e) => onSaveChairs(chairSpecs.map(c => c.id === chair.id ? { ...c, depth: parseFloat(e.target.value) || 1.5 } : c))} className="w-full border rounded px-3 py-2" />
                  </div>
                </div>
                <input type="color" value={chair.color} onChange={(e) => onSaveChairs(chairSpecs.map(c => c.id === chair.id ? { ...c, color: e.target.value } : c))} className="w-12 h-10" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}