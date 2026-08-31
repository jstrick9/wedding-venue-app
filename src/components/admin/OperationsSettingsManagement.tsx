import React, { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { emitDataChanged, on } from '../../utils/appEvents';
import { BrandedSectionHeader } from './shared/AdminSharedComponents';
import type { AdminCommonProps } from './AdminTabTypes';

export interface OperationsChecklistItem {
  id: string;
  text: string;
  phase: 'pre-event' | 'setup' | 'ceremony' | 'reception' | 'takedown';
  isRequired: boolean;
}

export interface OperationalZoneItem {
  id: string;
  name: string;
  description: string;
}

const DEFAULT_CHECKLIST: OperationsChecklistItem[] = [
  {
    id: 'oc-1',
    text: 'Confirm floor plan approval and final guest count with couple',
    phase: 'pre-event',
    isRequired: true,
  },
  {
    id: 'oc-2',
    text: 'Inspect bridal suite and stocking of amenities',
    phase: 'pre-event',
    isRequired: true,
  },
  {
    id: 'oc-3',
    text: 'Setup ceremony chairs per approved layout plan',
    phase: 'setup',
    isRequired: true,
  },
  {
    id: 'oc-4',
    text: 'Verify sound and microphone checks at ceremony lawn',
    phase: 'setup',
    isRequired: true,
  },
  {
    id: 'oc-5',
    text: 'Coordinate bridal party line-up and processional timing',
    phase: 'ceremony',
    isRequired: true,
  },
  {
    id: 'oc-6',
    text: 'Check reception lighting, catering prep kitchen, and bar stations',
    phase: 'reception',
    isRequired: true,
  },
  {
    id: 'oc-7',
    text: 'Complete post-event inventory check and lock-up',
    phase: 'takedown',
    isRequired: true,
  },
];

const DEFAULT_ZONES: OperationalZoneItem[] = [
  { id: 'oz-1', name: 'Main Manor & Great Hall', description: 'Primary indoor event space and welcome foyer' },
  { id: 'oz-2', name: 'Ceremony Lawn', description: 'Outdoor lawn and arbor ceremony setting' },
  { id: 'oz-3', name: 'Reception Pavilion', description: 'Covered outdoor reception and dance floor area' },
  { id: 'oz-4', name: 'Bridal Suite & Groom Lounge', description: 'Getting-ready suites and private lounges' },
  { id: 'oz-5', name: 'Catering Prep Kitchen', description: 'Vendor food prep and staging kitchen' },
];

export function getOperationsChecklistDefaults(): OperationsChecklistItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OPERATIONS_SETTINGS);
    if (!raw) return DEFAULT_CHECKLIST;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.checklist) && parsed.checklist.length > 0
      ? parsed.checklist
      : DEFAULT_CHECKLIST;
  } catch {
    return DEFAULT_CHECKLIST;
  }
}

export function getOperationalZoneDefaults(): OperationalZoneItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OPERATIONS_SETTINGS);
    if (!raw) return DEFAULT_ZONES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.zones) && parsed.zones.length > 0 ? parsed.zones : DEFAULT_ZONES;
  } catch {
    return DEFAULT_ZONES;
  }
}

export function saveOperationsSettings(
  checklist: OperationsChecklistItem[],
  zones: OperationalZoneItem[]
): void {
  try {
    localStorage.setItem(
      STORAGE_KEYS.OPERATIONS_SETTINGS,
      JSON.stringify({ checklist, zones })
    );
    emitDataChanged('all');
  } catch {
    // ignore quota error
  }
}

export function OperationsSettingsManagement(props: AdminCommonProps) {
  const { config, showSuccess } = props;
  const [checklist, setChecklist] = useState<OperationsChecklistItem[]>(() =>
    getOperationsChecklistDefaults()
  );
  const [zones, setZones] = useState<OperationalZoneItem[]>(() =>
    getOperationalZoneDefaults()
  );
  const [activeTab, setActiveTab] = useState<'checklists' | 'zones'>('checklists');
  const [selectedPhase, setSelectedPhase] = useState<string>('all');

  const [newItem, setNewItem] = useState({
    text: '',
    phase: 'pre-event' as OperationsChecklistItem['phase'],
    isRequired: true,
  });

  const [newZone, setNewZone] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    return on('spm_data_changed', () => {
      setChecklist(getOperationsChecklistDefaults());
      setZones(getOperationalZoneDefaults());
    });
  }, []);

  const handleAddChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.text.trim()) return;
    const item: OperationsChecklistItem = {
      id: `oc-${Date.now()}`,
      text: newItem.text.trim(),
      phase: newItem.phase,
      isRequired: newItem.isRequired,
    };
    const updated = [...checklist, item];
    setChecklist(updated);
    saveOperationsSettings(updated, zones);
    setNewItem({ text: '', phase: 'pre-event', isRequired: true });
    showSuccess('Default checklist item added!');
  };

  const handleDeleteChecklist = (id: string) => {
    const updated = checklist.filter((i) => i.id !== id);
    setChecklist(updated);
    saveOperationsSettings(updated, zones);
    showSuccess('Checklist item removed!');
  };

  const handleAddZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZone.name.trim()) return;
    const item: OperationalZoneItem = {
      id: `oz-${Date.now()}`,
      name: newZone.name.trim(),
      description: newZone.description.trim() || 'Standard operational area',
    };
    const updated = [...zones, item];
    setZones(updated);
    saveOperationsSettings(checklist, updated);
    setNewZone({ name: '', description: '' });
    showSuccess('Operational zone added!');
  };

  const handleDeleteZone = (id: string) => {
    const updated = zones.filter((z) => z.id !== id);
    setZones(updated);
    saveOperationsSettings(checklist, updated);
    showSuccess('Operational zone removed!');
  };

  const handleResetDefaults = () => {
    setChecklist(DEFAULT_CHECKLIST);
    setZones(DEFAULT_ZONES);
    saveOperationsSettings(DEFAULT_CHECKLIST, DEFAULT_ZONES);
    showSuccess('Reset to Seven Paths Manor operations defaults.');
  };

  const filteredChecklist =
    selectedPhase === 'all'
      ? checklist
      : checklist.filter((i) => i.phase === selectedPhase);

  return (
    <div className="space-y-6">
      <BrandedSectionHeader
        icon="🛠️"
        title="Operations &amp; Event-Day Checklist Settings"
        description="Configure default operational checklists by phase and standard venue zones for Seven Paths Manor."
        config={config}
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('checklists')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'checklists'
              ? 'text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
          style={
            activeTab === 'checklists'
              ? { backgroundColor: config?.primaryColor || '#4A1942' }
              : undefined
          }
        >
          📋 Default Event Checklists ({checklist.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('zones')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'zones'
              ? 'text-white shadow-sm'
              : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
          style={
            activeTab === 'zones'
              ? { backgroundColor: config?.primaryColor || '#4A1942' }
              : undefined
          }
        >
          📍 Standard Operational Zones ({zones.length})
        </button>
      </div>

      {activeTab === 'checklists' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Checklist Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-gray-900">
              ➕ Add Default Checklist Item
            </h3>
            <form onSubmit={handleAddChecklist} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Event Phase
                </label>
                <select
                  value={newItem.phase}
                  onChange={(e: any) => setNewItem({ ...newItem, phase: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="pre-event">⏳ Pre-Event &amp; Prep</option>
                  <option value="setup">🏗️ Setup &amp; Vendor Arrival</option>
                  <option value="ceremony">💒 Ceremony</option>
                  <option value="reception">🎉 Reception &amp; Dinner</option>
                  <option value="takedown">🧹 Takedown &amp; Lock-up</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Checklist Task Wording
                </label>
                <textarea
                  value={newItem.text}
                  onChange={(e) => setNewItem({ ...newItem, text: e.target.value })}
                  placeholder="e.g., Verify bridal suite linen stocking..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942] resize-none"
                />
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={newItem.isRequired}
                  onChange={(e) => setNewItem({ ...newItem, isRequired: e.target.checked })}
                  className="rounded border-gray-300 text-[#4A1942]"
                />
                <span>Required for event completion</span>
              </label>
              <button
                type="submit"
                disabled={!newItem.text.trim()}
                className="w-full py-2.5 rounded-lg text-white font-bold text-sm shadow-sm transition-all disabled:opacity-40"
                style={{ backgroundColor: config?.primaryColor || '#4A1942' }}
              >
                Save Checklist Item
              </button>
            </form>

            <div className="pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors"
              >
                🔄 Reset to Venue Operations Defaults
              </button>
            </div>
          </div>

          {/* List of Checklist Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-bold text-base text-gray-900">
                Default Checklist Items ({filteredChecklist.length})
              </h3>
              <select
                value={selectedPhase}
                onChange={(e) => setSelectedPhase(e.target.value)}
                className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700"
              >
                <option value="all">All Phases ({checklist.length})</option>
                <option value="pre-event">⏳ Pre-Event &amp; Prep</option>
                <option value="setup">🏗️ Setup</option>
                <option value="ceremony">💒 Ceremony</option>
                <option value="reception">🎉 Reception</option>
                <option value="takedown">🧹 Takedown</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {filteredChecklist.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800 uppercase">
                        {item.phase}
                      </span>
                      {item.isRequired && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 uppercase">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900">{item.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklist(item.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors shrink-0"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Operational Zones Tab */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-gray-900">
              ➕ Add Standard Operational Zone
            </h3>
            <form onSubmit={handleAddZone} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Zone Name
                </label>
                <input
                  type="text"
                  value={newZone.name}
                  onChange={(e) => setNewZone({ ...newZone, name: e.target.value })}
                  placeholder="e.g., East Lawn Pavilion"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Description / Purpose
                </label>
                <textarea
                  value={newZone.description}
                  onChange={(e) => setNewZone({ ...newZone, description: e.target.value })}
                  placeholder="Describe standard setup and staff duties..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#4A1942] resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={!newZone.name.trim()}
                className="w-full py-2.5 rounded-lg text-white font-bold text-sm shadow-sm transition-all disabled:opacity-40"
                style={{ backgroundColor: config?.primaryColor || '#4A1942' }}
              >
                Save Operational Zone
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-bold text-base text-gray-900">
              Standard Venue Operational Zones ({zones.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-start justify-between gap-4"
                >
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                      <span>📍</span> {zone.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">{zone.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteZone(zone.id)}
                    className="px-2.5 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors shrink-0"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default OperationsSettingsManagement;
