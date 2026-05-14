// src/components/admin/VenueManagement.tsx
import React from 'react';
import { Venue, LayoutCategory, ShapeType, PatternType } from '../../types';
import { layoutCategories, patternOptions } from '../../data/venueData';
import { Config } from '../../config';
import MultiImageUpload from '../MultiImageUpload';
import { BrandedSectionHeader, BrandedStatCard, BrandedTips } from './shared/AdminSharedComponents';

// Local default pattern colors (was missing from venueData.ts)
const defaultPatternColors: Record<PatternType, any> = {
  solid: { color1: '#FFFFFF', color2: '#FFFFFF' },
  wood: { color1: '#DEB887', color2: '#CD853F' },
  tile: { color1: '#E8E8E8', color2: '#D0D0D0' },
  brick: { color1: '#B74A3A', color2: '#8B4513' },
  marble: { color1: '#F5F5F5', color2: '#C0C0C0' },
  grass: { color1: '#90EE90', color2: '#228B22' },
  gravel: { color1: '#B8860B', color2: '#8B7355' },
  checkered: { color1: '#FFFFFF', color2: '#1a1a1a' },
  concrete: { color1: '#C0C0C0', color2: '#A9A9A9' },
  water: { color1: '#87CEEB', color2: '#4169E1' },
  carpet: { color1: '#8B4513', color2: '#654321' },
};

function PatternColorPicker({ pattern, patternColors, onChange }: any) {
  if (pattern === 'solid') return null;
  const colors = patternColors || defaultPatternColors[pattern];
  return (
    <div className="mt-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
      <h5 className="text-xs font-semibold text-purple-800 mb-2">🎨 Pattern Colors</h5>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs">Color 1</label>
          <input type="color" value={colors.color1} onChange={(e) => onChange({ ...colors, color1: e.target.value })} className="w-10 h-8" />
        </div>
        <div>
          <label className="text-xs">Color 2</label>
          <input type="color" value={colors.color2} onChange={(e) => onChange({ ...colors, color2: e.target.value })} className="w-10 h-8" />
        </div>
      </div>
    </div>
  );
}

interface VenueManagementProps {
  venues: Venue[];
  config: Config;
  onSaveVenues: (venues: Venue[]) => void;
  expandedVenues: Set<string>;
  onToggleVenue: (id: string) => void;
  customShapeVenueId: string | null;
  onOpenShapeBuilder: (id: string) => void;
}

export function VenueManagement({
  venues,
  config,
  onSaveVenues,
  expandedVenues,
  onToggleVenue,
  customShapeVenueId,
  onOpenShapeBuilder,
}: VenueManagementProps) {

  const handleSaveVenues = (updated: Venue[]) => onSaveVenues(updated);

  return (
    <div className="space-y-4">
      <BrandedSectionHeader 
        icon="🏛️" 
        title="Venue Layouts" 
        description="Create and manage venue spaces for receptions, ceremonies, and events"
        config={config}
      />

      {/* Quick Statistics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <BrandedStatCard icon="🏛️" label="Total Venues" value={venues.length} config={config} variant="primary" />
        <BrandedStatCard icon="★" label="Master" value={venues.filter(v => v.isMaster).length} config={config} variant="warning" />
        <BrandedStatCard icon="📐" label="With Layouts" value={venues.filter(v => v.masterLayout).length} config={config} variant="success" />
        <BrandedStatCard icon="👥" label="Total Capacity" value={venues.reduce((sum, v) => sum + (v.capacity || 0), 0)} config={config} variant="accent" />
        <div className="p-3 rounded-xl text-center border" style={{ backgroundColor: `${config.primaryLight}15`, borderColor: `${config.primaryLight}30` }}>
          <div className="flex justify-center gap-1 mb-1">
            {layoutCategories.slice(0, 4).map(cat => <span key={cat.id} className="text-lg">{cat.icon}</span>)}
          </div>
          <div className="text-xs" style={{ color: config.primaryColor }}>Categories</div>
        </div>
      </div>

      {/* Quick Add Venue Presets */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-800 text-sm mb-3 flex items-center gap-2">✨ Quick Add Venue Presets</h4>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => {
            const preset: Venue = { id: `venue-${Date.now()}`, name: 'Reception Venue', width: 60, height: 40, capacity: 150, category: 'reception', color: '#F5F0E8', borderColor: '#4A1942', pattern: 'wood', isMaster: true, canvasWidth: 140, canvasHeight: 120, venueX: 40, venueY: 40, exteriorPadding: { top: 40, right: 40, bottom: 40, left: 40 } };
            handleSaveVenues([...venues, preset]);
          }} className="px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm hover:bg-purple-50">🎉 Reception</button>

          <button onClick={() => {
            const preset: Venue = { id: `venue-${Date.now()}`, name: 'Cocktail Hour Venue', width: 40, height: 30, capacity: 75, category: 'cocktail', color: '#E8E0D0', borderColor: '#8B7355', pattern: 'concrete', isMaster: true, canvasWidth: 100, canvasHeight: 90, venueX: 30, venueY: 30, exteriorPadding: { top: 30, right: 30, bottom: 30, left: 30 } };
            handleSaveVenues([...venues, preset]);
          }} className="px-3 py-2 bg-white border border-amber-300 rounded-lg text-sm hover:bg-amber-50">🍸 Cocktail Hour</button>

          <button onClick={() => {
            const preset: Venue = { id: `venue-${Date.now()}`, name: 'Ceremony Venue', width: 80, height: 60, capacity: 200, category: 'ceremony', color: '#90EE90', borderColor: '#228B22', pattern: 'grass', isMaster: true, canvasWidth: 160, canvasHeight: 140, venueX: 40, venueY: 40, exteriorPadding: { top: 40, right: 40, bottom: 40, left: 40 } };
            handleSaveVenues([...venues, preset]);
          }} className="px-3 py-2 bg-white border border-green-300 rounded-lg text-sm hover:bg-green-50">💒 Ceremony</button>

          <button onClick={() => {
            const preset: Venue = { id: `venue-${Date.now()}`, name: 'Lodging Venue', width: 40, height: 30, capacity: 20, category: 'lodging', color: '#FFF8DC', borderColor: '#8B4513', pattern: 'wood', isMaster: true, canvasWidth: 100, canvasHeight: 90, venueX: 30, venueY: 30, exteriorPadding: { top: 30, right: 30, bottom: 30, left: 30 } };
            handleSaveVenues([...venues, preset]);
          }} className="px-3 py-2 bg-white border border-indigo-300 rounded-lg text-sm hover:bg-indigo-50">🏨 Lodging</button>

          <button onClick={() => {
            const preset: Venue = { id: `venue-${Date.now()}`, name: 'Rehearsal Dinner Venue', width: 30, height: 25, capacity: 40, category: 'rehearsal-dinner', color: '#F8F4E8', borderColor: '#4A1942', pattern: 'wood', isMaster: true, canvasWidth: 80, canvasHeight: 75, venueX: 25, venueY: 25, exteriorPadding: { top: 25, right: 25, bottom: 25, left: 25 } };
            handleSaveVenues([...venues, preset]);
          }} className="px-3 py-2 bg-white border border-rose-300 rounded-lg text-sm hover:bg-rose-50">🍽️ Rehearsal Dinner</button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setExpandedVenues(new Set(venues.map(v => v.id)))} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">▼ Expand All</button>
          <button onClick={() => setExpandedVenues(new Set())} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm">▲ Collapse All</button>
        </div>
        <button onClick={() => {
          const newVenue: Venue = { id: `venue-${Date.now()}`, name: 'New Venue', width: 50, height: 30, capacity: 100, category: 'reception', color: '#FFFFFF', borderColor: '#4A1942', pattern: 'wood', isMaster: true, exteriorPadding: { top: 30, right: 30, bottom: 30, left: 30 } };
          handleSaveVenues([...venues, newVenue]);
        }} className="px-4 py-1.5 bg-gradient-to-r from-[#4A1942] to-[#6d2c5a] text-white rounded-lg text-sm flex items-center gap-1">+ Add Venue</button>
      </div>

      {/* Category Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {layoutCategories.map(cat => (
          <span key={cat.id} className="px-2 py-1 bg-gray-100 rounded-full flex items-center gap-1 text-gray-600">
            {cat.icon} {cat.name} ({venues.filter(v => v.category === cat.id).length})
          </span>
        ))}
      </div>

      {/* Venues List */}
      <div className="space-y-3">
        {venues.map(venue => {
          const category = layoutCategories.find(c => c.id === venue.category);
          const isExpanded = expandedVenues.has(venue.id);

          return (
            <div key={venue.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: venue.borderColor || '#4A1942' }} />
              <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => onToggleVenue(venue.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-10 rounded border-2 flex items-center justify-center text-lg" style={{ backgroundColor: venue.color, borderColor: venue.borderColor }}>
                    {category?.icon || '🏛️'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{isExpanded ? '▼' : '▶'}</span>
                      <span className="font-semibold">{venue.name}</span>
                      {venue.isMaster && <span className="text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded">★</span>}
                      {venue.masterLayout && <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">📐</span>}
                    </div>
                    <div className="text-xs text-gray-500">{venue.width}' × {venue.height}' • 👥 {venue.capacity}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: `${venue.borderColor}15`, color: venue.borderColor }}>{category?.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); const copy = { ...venue, id: `venue-${Date.now()}`, name: `${venue.name} (Copy)`, masterLayout: undefined }; handleSaveVenues([...venues, copy]); }} className="text-gray-400 hover:text-blue-600 px-1">📋</button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${venue.name}"?`)) handleSaveVenues(venues.filter(v => v.id !== venue.id)); }} className="text-gray-400 hover:text-red-500 px-1">🗑️</button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 space-y-4 border-t">
                  {/* Basic Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div><label className="text-xs">Name</label><input type="text" value={venue.name} onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, name: e.target.value } : v))} className="w-full px-3 py-2 border rounded-lg" /></div>
                    <div><label className="text-xs">Width</label><input type="number" value={venue.width} onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, width: parseInt(e.target.value) || 0 } : v))} className="w-full px-3 py-2 border rounded-lg" /></div>
                    <div><label className="text-xs">Height</label><input type="number" value={venue.height} onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, height: parseInt(e.target.value) || 0 } : v))} className="w-full px-3 py-2 border rounded-lg" /></div>
                    <div><label className="text-xs">Capacity</label><input type="number" value={venue.capacity} onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, capacity: parseInt(e.target.value) || 0 } : v))} className="w-full px-3 py-2 border rounded-lg" /></div>
                    <div><label className="text-xs">Category</label><select value={venue.category} onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, category: e.target.value as LayoutCategory } : v))} className="w-full px-3 py-2 border rounded-lg">{layoutCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                  </div>

                  {/* Shape Builder */}
                  <div>
                    <button onClick={() => onOpenShapeBuilder(venue.id)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">✏️ Open Shape Builder</button>
                  </div>

                  {/* Fill Color */}
                  {(venue.pattern === 'solid' || !venue.pattern) && (
                    <div className="p-3 bg-amber-50 rounded-lg border">
                      <label className="text-sm font-semibold">🎨 Venue Fill Color</label>
                      <input type="color" value={venue.color || '#FFFFFF'} onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, color: e.target.value } : v))} className="w-16 h-10 mt-1" />
                    </div>
                  )}

                  {/* Border Settings */}
                  <div className="p-3 bg-purple-50 rounded-lg border">
                    <h4 className="text-sm font-semibold mb-2">🔲 Border Settings</h4>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={venue.showBorder !== false} onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, showBorder: e.target.checked } : v))} />
                        <span>Show Border</span>
                      </label>
                      {venue.showBorder !== false && (
                        <>
                          <input type="color" value={venue.borderColor || '#4A1942'} onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, borderColor: e.target.value } : v))} className="w-10 h-8" />
                          <input type="number" value={venue.borderWidth || 2} onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, borderWidth: parseInt(e.target.value) || 1 } : v))} className="w-20 px-2 py-1 border rounded" />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Master Venue */}
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={venue.isMaster || false} onChange={(e) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, isMaster: e.target.checked } : v))} />
                      <span>Master Venue (visible to basic users)</span>
                    </label>
                  </div>

                  {/* Master Layout */}
                  <div className="bg-amber-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">📐 Master Layout</span>
                      {venue.masterLayout && (
                        <button onClick={() => {
                          if (confirm(`Clear master layout for "${venue.name}"?`)) {
                            handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, masterLayout: undefined } : v));
                          }
                        }} className="text-xs text-orange-600">Clear</button>
                      )}
                    </div>
                  </div>

                  {/* Images */}
                  <div>
                    <label className="text-xs">Primary Venue Image</label>
                    <div className="flex gap-2 mt-1">
                      {venue.imageUrl && <img src={venue.imageUrl} className="w-16 h-16 object-cover rounded border" />}
                      <button className="px-3 py-1 bg-gray-100 rounded text-sm">📷 Upload</button>
                    </div>
                    <MultiImageUpload images={venue.images || []} onChange={(imgs) => handleSaveVenues(venues.map(v => v.id === venue.id ? { ...v, images: imgs } : v))} maxImages={10} itemName="venue" />
                  </div>

                  <button onClick={() => handleSaveVenues(venues.filter(v => v.id !== venue.id))} className="text-red-600 text-sm">🗑️ Delete Venue</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <BrandedTips
        title="Tips for Venue Setup"
        config={config}
        tips={[
          { icon: '★', title: 'Master Venue', description: 'Mark venues as "Master" so basic users can see and use them' },
          { icon: '📐', title: 'Master Layout', description: 'Save a pre-configured layout with fixtures' },
          { icon: '🖼️', title: 'Images', description: 'Upload up to 10 reference images per venue' }
        ]}
      />
    </div>
  );
}