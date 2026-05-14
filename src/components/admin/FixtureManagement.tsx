import React from 'react';
import { FixtureType } from '../../types';
import { Config } from '../../config';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';

interface FixtureManagementProps {
  fixtureTypes: FixtureType[];
  config: Config;
  onSaveFixtures: (fixtures: FixtureType[]) => void;
  expandedFixtures: Set<string>;
  onToggleFixture: (id: string) => void;
  onShowDrawingTool: () => void;
}

export function FixtureManagement({ fixtureTypes, config, onSaveFixtures, expandedFixtures, onToggleFixture, onShowDrawingTool }: FixtureManagementProps) {
  const venueFixtures = fixtureTypes.filter(f => f.category === 'interior');

  return (
    <div className="space-y-4">
      <BrandedSectionHeader icon="📦" title="Fixtures & Features" description="Interior and exterior venue fixtures" config={config} />

      <div className="flex justify-between">
        <span className="text-sm text-gray-600">{venueFixtures.length} venue fixtures</span>
        <div className="flex gap-2">
          <button onClick={onShowDrawingTool} className="px-4 py-2 bg-purple-600 text-white rounded-lg">🎨 Draw Custom</button>
          <button onClick={() => {
            const newFix: FixtureType = {
              id: `fix-${Date.now()}`,
              name: 'New Fixture',
              shape: 'rectangle',
              width: 4,
              height: 4,
              icon: '📦',
              color: '#E5E5E5',
              category: 'interior'
            };
            onSaveFixtures([...fixtureTypes, newFix]);
          }} className="px-4 py-2 bg-[#4A1942] text-white rounded-lg">+ Add Fixture</button>
        </div>
      </div>

      <div className="space-y-3">
        {venueFixtures.map(fixture => (
          <div key={fixture.id} className="bg-white rounded-xl border p-4">
            <div className="flex justify-between cursor-pointer" onClick={() => onToggleFixture(fixture.id)}>
              <div className="flex items-center gap-3">
                <span>{expandedFixtures.has(fixture.id) ? '▼' : '▶'}</span>
                <span className="text-2xl">{fixture.icon}</span>
                <span className="font-semibold">{fixture.name}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onSaveFixtures(fixtureTypes.filter(f => f.id !== fixture.id)); }} className="text-red-500">🗑️</button>
            </div>

            {expandedFixtures.has(fixture.id) && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs">Name</label>
                  <input type="text" value={fixture.name} onChange={(e) => onSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, name: e.target.value } : f))} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs">Width</label>
                  <input type="number" value={fixture.width} onChange={(e) => onSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, width: parseFloat(e.target.value) || 4 } : f))} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs">Height</label>
                  <input type="number" value={fixture.height} onChange={(e) => onSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, height: parseFloat(e.target.value) || 4 } : f))} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs">Color</label>
                  <input type="color" value={fixture.color || '#E5E5E5'} onChange={(e) => onSaveFixtures(fixtureTypes.map(f => f.id === fixture.id ? { ...f, color: e.target.value } : f))} className="w-full h-10" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}