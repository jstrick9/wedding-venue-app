import React from 'react';
import { LayoutTemplate, Venue } from '../../types';
import { Config } from '../../config';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';

interface TemplateManagementProps {
  templates: LayoutTemplate[];
  venues: Venue[];
  config: Config;
  onSaveTemplates: (templates: LayoutTemplate[]) => void;
  onLoadTemplate: (template: LayoutTemplate) => void;
  expandedTemplates: Set<string>;
  onToggleTemplate: (id: string) => void;
}

export function TemplateManagement({ templates, venues, config, onSaveTemplates, onLoadTemplate, expandedTemplates, onToggleTemplate }: TemplateManagementProps) {
  return (
    <div className="space-y-4">
      <BrandedSectionHeader icon="📋" title="Layout Templates" description="Reusable layouts for quick setup" config={config} />

      <div className="flex justify-end">
        <button
          onClick={() => {
            const newTemplate: LayoutTemplate = {
              id: `template-${Date.now()}`,
              name: 'New Template',
              description: '',
              venueId: venues[0]?.id || '',
              category: 'reception',
              tables: [],
              fixtures: [],
              isMasterTemplate: false,
              createdAt: new Date().toISOString()
            };
            onSaveTemplates([...templates, newTemplate]);
          }}
          className="px-4 py-2 bg-[#4A1942] text-white rounded-lg"
        >
          + New Template
        </button>
      </div>

      <div className="space-y-3">
        {templates.map(template => (
          <div key={template.id} className="bg-white rounded-xl border p-4">
            <div className="flex justify-between cursor-pointer" onClick={() => onToggleTemplate(template.id)}>
              <div>
                <span className="font-semibold">{template.name}</span>
                {template.isMasterTemplate && <span className="ml-2 text-xs bg-amber-500 text-white px-2 py-0.5 rounded">★ Master</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); onLoadTemplate(template); }} className="text-blue-600 text-sm">Load</button>
                <button onClick={(e) => { e.stopPropagation(); onSaveTemplates(templates.filter(t => t.id !== template.id)); }} className="text-red-500">🗑️</button>
              </div>
            </div>

            {expandedTemplates.has(template.id) && (
              <div className="mt-4">
                <input type="text" value={template.name} onChange={(e) => onSaveTemplates(templates.map(t => t.id === template.id ? { ...t, name: e.target.value } : t))} className="w-full border rounded px-3 py-2 mb-3" />
                <div className="flex gap-2">
                  <button onClick={() => onLoadTemplate(template)} className="flex-1 bg-blue-600 text-white py-2 rounded">Load for Editing</button>
                  <button onClick={() => onSaveTemplates(templates.filter(t => t.id !== template.id))} className="px-4 text-red-600 border border-red-200 rounded">Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}