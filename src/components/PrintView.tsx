import { Venue, PlacedTable, PlacedFixture, Guest } from '../types';
import { getTableSpecs, getFixtureTypes } from '../hooks/useLayoutState';
import { getConfig } from '../config';

export interface PrintViewProps {
  venue: Venue;
  tables: PlacedTable[];
  fixtures: PlacedFixture[];
  guests: Guest[];
  layoutName: string;
  onClose: () => void;
}

export function PrintView({
  venue,
  tables,
  fixtures,
  guests,
  layoutName,
  onClose,
}: PrintViewProps) {
  const tableSpecs = getTableSpecs();
  const fixtureTypes = getFixtureTypes();
  const config = getConfig();

  const handlePrint = () => {
    window.print();
  };

  const getTotalCapacity = () => {
    return tables.reduce((sum, table) => {
      const spec = tableSpecs.find(s => s.id === table.specId);
      return sum + (spec?.capacity || 0);
    }, 0);
  };

  const getSeatedGuests = () => {
    return guests.filter(g => tables.some(t => t.guests.includes(g.id))).length;
  };

  return (
    <div className="fixed inset-0 bg-white overflow-auto print:relative print:bg-transparent" style={{ zIndex: 10000 }}>
      {/* Print controls - hidden when printing */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2">
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-plum text-white rounded-lg hover:bg-plum-dark"
        >
          🖨️ Print
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Close
        </button>
      </div>

      {/* Printable content */}
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="text-center mb-8">
          {config.logoUrl && (
            <img src={config.logoUrl} alt="" className="h-16 mx-auto mb-4" />
          )}
          <h1 className="text-3xl font-bold text-gray-900">{config.venueName}</h1>
          <h2 className="text-xl text-gray-600 mt-2">{layoutName || 'Event Layout'}</h2>
          <p className="text-gray-500 mt-1">{venue.name} • {venue.width}' × {venue.height}'</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-8 text-center">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-plum">{tables.length}</div>
            <div className="text-sm text-gray-600">Tables</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-plum">{getTotalCapacity()}</div>
            <div className="text-sm text-gray-600">Total Capacity</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-plum">{guests.length}</div>
            <div className="text-sm text-gray-600">Total Guests</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-plum">{getSeatedGuests()}</div>
            <div className="text-sm text-gray-600">Seated</div>
          </div>
        </div>

        {/* Floor plan - simplified SVG */}
        <div className="border-2 border-gray-300 rounded-lg p-4 mb-8">
          <h3 className="font-semibold text-lg mb-4 text-center">Floor Plan</h3>
          <svg
            viewBox={`0 0 ${venue.width + 20} ${venue.height + 20}`}
            className="w-full max-h-96"
            style={{ aspectRatio: `${venue.width}/${venue.height}` }}
          >
            {/* Venue outline */}
            <rect
              x={10}
              y={10}
              width={venue.width}
              height={venue.height}
              fill="#f9fafb"
              stroke="#374151"
              strokeWidth="0.5"
            />

            {/* Tables */}
            {tables.map(table => {
              const spec = tableSpecs.find(s => s.id === table.specId);
              if (!spec) return null;
              const x = 10 + table.x;
              const y = 10 + table.y;
              return (
                <g key={table.id}>
                  {spec.shape === 'circle' ? (
                    <ellipse
                      cx={x + spec.width / 2}
                      cy={y + spec.height / 2}
                      rx={spec.width / 2}
                      ry={spec.height / 2}
                      fill="#e5e7eb"
                      stroke="#374151"
                      strokeWidth="0.3"
                    />
                  ) : (
                    <rect
                      x={x}
                      y={y}
                      width={spec.width}
                      height={spec.height}
                      fill="#e5e7eb"
                      stroke="#374151"
                      strokeWidth="0.3"
                    />
                  )}
                  <text
                    x={x + spec.width / 2}
                    y={y + spec.height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="2"
                    className="font-medium"
                  >
                    {table.label}
                  </text>
                </g>
              );
            })}

            {/* Fixtures */}
            {fixtures.map(fixture => {
              const spec = fixtureTypes.find(s => s.id === fixture.specId);
              if (!spec || fixture.isExterior) return null;
              const x = 10 + fixture.x;
              const y = 10 + fixture.y;
              return (
                <g key={fixture.id}>
                  <rect
                    x={x}
                    y={y}
                    width={spec.width}
                    height={spec.height}
                    fill={spec.color || '#d1d5db'}
                    stroke="#374151"
                    strokeWidth="0.3"
                  />
                  <text
                    x={x + spec.width / 2}
                    y={y + spec.height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="1.5"
                  >
                    {spec.icon}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Seating chart */}
        <div className="mb-8">
          <h3 className="font-semibold text-lg mb-4">Seating Chart</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {tables.map(table => {
              const spec = tableSpecs.find(s => s.id === table.specId);
              const tableGuests = guests.filter(g => table.guests.includes(g.id));
              return (
                <div key={table.id} className="border rounded-lg p-3">
                  <div className="font-medium text-gray-900">{table.label}</div>
                  <div className="text-xs text-gray-500 mb-2">
                    {spec?.name} • {tableGuests.length}/{spec?.capacity || 0} seats
                  </div>
                  {tableGuests.length > 0 ? (
                    <ul className="text-sm space-y-1">
                      {tableGuests.map(guest => (
                        <li key={guest.id} className="text-gray-700">• {guest.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No guests assigned</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Unassigned guests */}
        {guests.filter(g => !g.tableId).length > 0 && (
          <div className="mb-8">
            <h3 className="font-semibold text-lg mb-4">Unassigned Guests</h3>
            <div className="grid grid-cols-3 gap-2">
              {guests.filter(g => !g.tableId).map(guest => (
                <div key={guest.id} className="text-sm text-gray-600">
                  • {guest.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 mt-8 pt-8 border-t">
          <p>Generated by {config.venueName} Layout Planner</p>
          <p>{new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
