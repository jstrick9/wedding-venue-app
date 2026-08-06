import { useState } from 'react';
import { Venue, LayoutTemplate, LayoutCategoryInfo } from '../types';
import { Badge, Card, EmptyState } from './ui';
import ModalDialog from './ModalDialog';
import { formatDate, formatTime } from '../utils/dateTime';

export interface StudioLayoutsHomeProps {
  venues: Venue[];
  currentVenueId: string;
  templates: LayoutTemplate[];
  layoutCategories: LayoutCategoryInfo[];
  canEdit: boolean;
  onOpenVenue: (venueId: string) => void;
  onSelectTemplate: (template: LayoutTemplate) => void;
  onClose: () => void;
}

/**
 * Layout Studio home: a space picker with per-space capacity + master-layout
 * status, plus a quick template gallery. Gives the studio its own module
 * identity (B4) instead of dropping the user straight onto the canvas.
 */
export function StudioLayoutsHome({
  venues,
  currentVenueId,
  templates,
  layoutCategories,
  canEdit,
  onOpenVenue,
  onSelectTemplate,
  onClose,
}: StudioLayoutsHomeProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | string>('all');

  const filteredTemplates =
    selectedCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === selectedCategory);

  const totalSeating = venues.reduce((sum, v) => sum + (v.capacity || 0), 0);
  const spacesWithMaster = venues.filter((v) => v.masterLayout).length;

  return (
    <ModalDialog
      title="Spaces & Layouts"
      description="Pick a venue space to design, or start from a quick template"
      onClose={onClose}
      className="max-w-5xl"
    >
      <div className="space-y-6">
        {/* Summary strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4">
            <div className="text-xs text-gray-500 font-medium">Venue spaces</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{venues.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-gray-500 font-medium">Total seating capacity</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {totalSeating.toLocaleString()}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-gray-500 font-medium">Spaces with a master layout</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">
              {spacesWithMaster}
              <span className="text-sm text-gray-400 font-normal"> / {venues.length}</span>
            </div>
          </Card>
        </div>

        {/* Venue spaces / space picker */}
        <section aria-label="Venue spaces">
          <h3 className="font-semibold text-gray-800 mb-3">🏛️ Venue spaces</h3>
          {venues.length === 0 ? (
            <EmptyState
              icon="🏛️"
              title="No venue spaces yet"
              hint="Add a venue space under Admin → Venues to start designing layouts."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {venues.map((v) => {
                const cat = layoutCategories.find((c) => c.id === v.category);
                const isCurrent = v.id === currentVenueId;
                const master = v.masterLayout;
                const masterTables = master?.tables?.length ?? 0;
                return (
                  <Card key={v.id} className={`p-4 ${isCurrent ? 'ring-2 ring-[#4A1942]' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-2xl">{cat?.icon || '🏛️'}</div>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {isCurrent && <Badge tone="primary">Open now</Badge>}
                        <Badge tone={master ? 'success' : 'default'}>
                          {master ? '✓ Master saved' : 'No master'}
                        </Badge>
                      </div>
                    </div>
                    <h4 className="mt-2 font-semibold text-gray-900">{v.name}</h4>
                    <p className="text-xs text-gray-500 mt-0.5">{cat?.name || v.category}</p>

                    <dl className="mt-3 space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <dt>Seating capacity</dt>
                        <dd className="font-medium text-gray-900">{v.capacity || '—'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Dimensions</dt>
                        <dd className="font-medium text-gray-900">
                          {v.width}×{v.height}
                        </dd>
                      </div>
                      {master && (
                        <>
                          <div className="flex justify-between">
                            <dt>Master tables</dt>
                            <dd className="font-medium text-gray-900">{masterTables}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Master saved</dt>
                            <dd className="font-medium text-gray-900">
                              {formatDate(master.savedAt)}{' '}
                              {formatTime(master.savedAt)}
                            </dd>
                          </div>
                        </>
                      )}
                    </dl>

                    <button
                      type="button"
                      disabled={!canEdit && !isCurrent}
                      onClick={() => onOpenVenue(v.id)}
                      className="mt-3 w-full rounded-lg bg-[#4A1942] px-3 py-2 text-sm font-medium text-white hover:bg-[#3b1435] disabled:opacity-40"
                    >
                      {isCurrent ? 'Edit this space' : 'Open in editor'}
                    </button>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick template gallery */}
        <section aria-label="Quick templates">
          <h3 className="font-semibold text-gray-800 mb-3">⚡ Quick templates</h3>
          <div
            role="tablist"
            aria-label="Template categories"
            className="flex flex-wrap gap-2 mb-4"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedCategory === 'all'
                  ? 'bg-[#4A1942] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({templates.length})
            </button>
            {layoutCategories.map((cat) => {
              const count = templates.filter((t) => t.category === cat.id).length;
              if (count === 0) return null;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedCategory === cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                    selectedCategory === cat.id
                      ? 'bg-[#4A1942] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat.icon} {cat.name} ({count})
                </button>
              );
            })}
          </div>

          {filteredTemplates.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No templates in this category"
              hint="Save a layout as a template or switch categories."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTemplates.map((t) => {
                const cat = layoutCategories.find((c) => c.id === t.category);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTemplate(t)}
                    className="text-left rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-[#4A1942]/40 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-2xl">{cat?.icon || '📋'}</div>
                      <span className="text-xs rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                        {cat?.name || t.category}
                      </span>
                    </div>
                    <h4 className="mt-3 font-semibold text-gray-900">{t.name}</h4>
                    {t.description && (
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{t.description}</p>
                    )}
                    <div className="mt-2 text-sm text-gray-500">{t.tables.length} tables</div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
