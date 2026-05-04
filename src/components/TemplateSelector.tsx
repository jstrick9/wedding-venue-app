import { useState } from 'react';
import { LayoutTemplate, LayoutCategoryInfo } from '../types';
import { getVenues } from '../hooks/useLayoutState';

export interface TemplateSelectorProps {
  templates: LayoutTemplate[];
  layoutCategories: LayoutCategoryInfo[];
  onSelect: (template: LayoutTemplate) => void;
  onClose: () => void;
}

export function TemplateSelector({
  templates,
  layoutCategories,
  onSelect,
  onClose,
}: TemplateSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const venues = getVenues();

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  const getVenueName = (venueId: string) => {
    return venues.find(v => v.id === venueId)?.name || 'Unknown Venue';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Layout Templates</h2>
            <p className="text-sm text-gray-500">Choose a template to get started</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            ✕
          </button>
        </div>

        {/* Category filter */}
        <div className="p-4 border-b flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              selectedCategory === 'all'
                ? 'bg-plum text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Templates
          </button>
          {layoutCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedCategory === cat.id
                  ? 'bg-plum text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Templates grid */}
        <div className="flex-1 overflow-auto p-4">
          {filteredTemplates.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No templates available for this category.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => {
                const category = layoutCategories.find(c => c.id === template.category);
                return (
                  <div
                    key={template.id}
                    className="border rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer"
                    onClick={() => onSelect(template)}
                  >
                    {/* Preview */}
                    <div 
                      className="h-32 flex items-center justify-center"
                      style={{ backgroundColor: category?.color || '#f3f4f6' }}
                    >
                      <div className="text-4xl opacity-50">{category?.icon || '📋'}</div>
                    </div>
                    
                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                      <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                        <span>{getVenueName(template.venueId)}</span>
                        <span>{template.tables.length} tables</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
