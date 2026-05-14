import React from 'react';
import { Guideline } from '../../types';
import { Config } from '../../config';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';

interface GuidelineManagementProps {
  guidelines: Guideline[];
  config: Config;
  onSaveGuidelines: (guidelines: Guideline[]) => void;
  expandedGuidelines: Set<string>;
  onToggleGuideline: (id: string) => void;
}

export function GuidelineManagement({ guidelines, config, onSaveGuidelines, expandedGuidelines, onToggleGuideline }: GuidelineManagementProps) {
  return (
    <div className="space-y-4">
      <BrandedSectionHeader icon="💡" title="Layout Guidelines" description="Best practices and rules for layouts" config={config} />

      <div className="flex justify-end">
        <button onClick={() => {
          const newG: Guideline = {
            id: `guideline-${Date.now()}`,
            title: 'New Guideline',
            description: '',
            enabled: true,
            category: 'general',
            icon: '📋'
          };
          onSaveGuidelines([...guidelines, newG]);
        }} className="px-4 py-2 bg-amber-500 text-white rounded-lg">+ Add Guideline</button>
      </div>

      <div className="space-y-3">
        {guidelines.map(g => (
          <div key={g.id} className="bg-white rounded-xl border p-4">
            <div className="flex justify-between cursor-pointer" onClick={() => onToggleGuideline(g.id)}>
              <span className="font-medium">{g.title}</span>
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); onSaveGuidelines(guidelines.filter(x => x.id !== g.id)); }} className="text-red-500">🗑️</button>
              </div>
            </div>

            {expandedGuidelines.has(g.id) && (
              <div className="mt-3">
                <input type="text" value={g.title} onChange={(e) => onSaveGuidelines(guidelines.map(x => x.id === g.id ? { ...x, title: e.target.value } : x))} className="w-full border rounded px-3 py-2 mb-2" />
                <textarea value={g.description} onChange={(e) => onSaveGuidelines(guidelines.map(x => x.id === g.id ? { ...x, description: e.target.value } : x))} className="w-full border rounded px-3 py-2" rows={3} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}