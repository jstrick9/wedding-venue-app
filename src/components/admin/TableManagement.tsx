import React from 'react';
import { TableSpec, LayoutCategory } from '../../types';
import { layoutCategories, getChairSpecs } from '../../data/venueData';
import { Config } from '../../config';
import { BrandedSectionHeader, BrandedStatCard } from './shared/AdminSharedComponents';

interface TableManagementProps {
  tableSpecs: TableSpec[];
  config: Config;
  onSaveTables: (tables: TableSpec[]) => void;
  expandedTables: Set<string>;
  onToggleTable: (id: string) => void;
}

export function TableManagement({ tableSpecs, config, onSaveTables, expandedTables, onToggleTable }: TableManagementProps) {
  const tableTypes = tableSpecs.filter(t => !t.isSeatingType);

  return (
    <div className="space-y-4">
      <BrandedSectionHeader icon="🪑" title="Tables & Seating" description="Define table types and seating arrangements" config={config} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <BrandedStatCard icon="🪑" label="Table Types" value={tableTypes.length} config={config} />
        <BrandedStatCard icon="👥" label="Total Capacity" value={tableSpecs.reduce((s, t) => s + t.capacity, 0)} config={config} />
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-lg border">
        <span className="text-sm text-gray-600">{tableTypes.length} table types</span>
        <button
          onClick={() => {
            const newTable: TableSpec = {
              id: `table-${Date.now()}`,
              name: 'New Table',
              shape: 'circle',
              width: 6,
              height: 6,
              capacity: 8,
              color: '#F5F5DC',
              allowAsDecorBase: true
            };
            onSaveTables([...tableSpecs, newTable]);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
        >
          + Add Table Type
        </button>
      </div>

      <div className="space-y-3">
        {tableTypes.map(table => (
          <div key={table.id} className="bg-white rounded-xl border p-4">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => onToggleTable(table.id)}>
              <div className="flex items-center gap-3">
                <span>{expandedTables.has(table.id) ? '▼' : '▶'}</span>
                <span className="font-semibold">{table.name}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{table.shape}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveTables(tableSpecs.filter(t => t.id !== table.id));
                  }}
                  className="text-red-500 px-2"
                >
                  🗑️
                </button>
              </div>
            </div>

            {expandedTables.has(table.id) && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs">Name</label>
                  <input type="text" value={table.name} onChange={(e) => onSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, name: e.target.value } : t))} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs">Capacity</label>
                  <input type="number" value={table.capacity} onChange={(e) => onSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, capacity: parseInt(e.target.value) || 0 } : t))} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs">Width (ft)</label>
                  <input type="number" value={table.width} onChange={(e) => onSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, width: parseFloat(e.target.value) || 6 } : t))} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="text-xs">Height (ft)</label>
                  <input type="number" value={table.height} onChange={(e) => onSaveTables(tableSpecs.map(t => t.id === table.id ? { ...t, height: parseFloat(e.target.value) || 6 } : t))} className="w-full border rounded px-3 py-2" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}