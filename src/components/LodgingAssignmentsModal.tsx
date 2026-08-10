import { useMemo, useState } from 'react';
import { Guest, Venue } from '../types';
import { useBrandingConfig } from '../config';

export interface LodgingAssignmentsModalProps {
  venue: Venue;
  guests: Guest[];
  /** Assign a guest to a room (sets the guest's roomId). */
  onAssign: (guestId: string, room: string) => void;
  /** Clear a guest's room assignment. */
  onUnassign: (guestId: string) => void;
  onClose: () => void;
}

interface ConfigRoom {
  key: string;
  name: string;
  capacity: number;
}

/**
 * Couple-persona lodging drill-in: clicking a lodging space on the venue map
 * opens this panel so the couple can pick a room in that lodging venue and
 * assign guests to it — without leaving the map context. Rooms come from the
 * venue's lodging layout (floors → rooms, plus legacy single-floor rooms).
 */
export function LodgingAssignmentsModal({
  venue,
  guests,
  onAssign,
  onUnassign,
  onClose,
}: LodgingAssignmentsModalProps) {
  const config = useBrandingConfig();
  const [assignGuestId, setAssignGuestId] = useState('');
  const [assignRoom, setAssignRoom] = useState('');
  const [otherRoom, setOtherRoom] = useState('');
  const [error, setError] = useState('');

  const rooms = useMemo<ConfigRoom[]>(() => {
    const seen = new Set<string>();
    const list: ConfigRoom[] = [];
    const push = (name: string, capacity: number) => {
      const key = name.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      list.push({ key: name.trim(), name: name.trim(), capacity: Math.max(0, capacity) });
    };
    for (const floor of venue.floors || []) {
      for (const r of floor.rooms || []) push(r.name, r.capacity);
    }
    for (const r of venue.rooms || []) push(r.name, r.capacity);
    return list;
  }, [venue]);

  const roomNames = new Set(rooms.map((r) => r.name.toLowerCase()));

  // Guests currently assigned to a configured room.
  const assigned = guests.filter((g) => g.roomId && roomNames.has(g.roomId.toLowerCase()));
  // Guests not in a configured room (unassigned or free-text/other rooms).
  const others = guests.filter((g) => !(g.roomId && roomNames.has(g.roomId.toLowerCase())));

  const occupancy = (room: ConfigRoom) =>
    assigned.filter((g) => g.roomId?.toLowerCase() === room.name.toLowerCase());

  const effectiveRoom = assignRoom === '__other__' ? otherRoom.trim() : assignRoom;
  const chosenConfig = rooms.find((r) => r.name === assignRoom);

  const handleAssign = () => {
    const g = guests.find((x) => x.id === assignGuestId);
    if (!g) { setError('Choose a guest to assign.'); return; }
    if (!effectiveRoom) { setError('Choose or enter a room.'); return; }
    if (chosenConfig) {
      const occ = occupancy(chosenConfig);
      if (occ.length >= chosenConfig.capacity) {
        setError(`"${chosenConfig.name}" is full (capacity ${chosenConfig.capacity}).`);
        return;
      }
    }
    onAssign(g.id, effectiveRoom);
    setAssignGuestId('');
    setAssignRoom('');
    setOtherRoom('');
    setError('');
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[11000] p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Assign guests to ${venue.name}`}
      >
        {/* Header */}
        <div className="rounded-t-2xl bg-gradient-to-r from-teal-600 to-emerald-600 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">🛏️ {venue.name}</h2>
              <p className="text-xs text-white/80 mt-0.5">
                Assign guests &amp; rooms · capacity {venue.capacity || '—'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/90 hover:text-white text-xl leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          {venue.description && (
            <p className="text-[11px] text-white/75 mt-2">{venue.description}</p>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Assign control */}
          <div className="rounded-xl border border-gray-200 p-3 space-y-2">
            <span className="text-sm font-semibold text-gray-800">Assign a guest to a room</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="block text-xs text-gray-500">Guest
                <select
                  value={assignGuestId}
                  onChange={(e) => setAssignGuestId(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                  aria-label="Choose guest"
                >
                  <option value="">Choose a guest…</option>
                  {others.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                      {g.roomId ? ` (currently ${g.roomId})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-gray-500">Room
                <select
                  value={assignRoom}
                  onChange={(e) => setAssignRoom(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                  aria-label="Choose room"
                >
                  <option value="">Choose a room…</option>
                  {rooms.map((r) => (
                    <option key={r.key} value={r.name}>
                      {r.name} · {occupancy(r).length}/{r.capacity}
                    </option>
                  ))}
                  <option value="__other__">Other room…</option>
                </select>
              </label>
            </div>
            {assignRoom === '__other__' && (
              <input
                type="text"
                value={otherRoom}
                onChange={(e) => setOtherRoom(e.target.value)}
                placeholder="Room name (e.g. Cottage Suite 3)"
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                aria-label="Other room name"
              />
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleAssign}
              className="btn-primary w-full px-3 py-1.5 rounded-lg text-white text-sm font-medium shadow-sm transition-colors"
              style={{ backgroundColor: config.primaryColor || '#4A1942' }}
            >
              Assign to room
            </button>
          </div>

          {/* Configured rooms */}
          {rooms.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Rooms</h3>
              <div className="space-y-2">
                {rooms.map((room) => {
                  const occ = occupancy(room);
                  const full = occ.length >= room.capacity;
                  return (
                    <div key={room.key} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-800">🚪 {room.name}</span>
                        <span className={`text-xs ${full ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          {occ.length}/{room.capacity}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full ${full ? 'bg-red-400' : 'bg-teal-500'}`}
                          style={{ width: `${room.capacity ? Math.min(100, (occ.length / room.capacity) * 100) : 0}%` }}
                        />
                      </div>
                      {occ.length === 0 ? (
                        <p className="text-xs text-gray-400 mt-2">No guests assigned.</p>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {occ.map((g) => (
                            <li key={g.id} className="flex items-center justify-between text-sm text-gray-700">
                              <span>{g.name}</span>
                              <button
                                type="button"
                                onClick={() => onUnassign(g.id)}
                                className="text-red-400 hover:text-red-600 text-xs"
                                aria-label={`Remove ${g.name} from ${room.name}`}
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unassigned / other */}
          <div>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              {rooms.length > 0 ? 'Unassigned guests' : 'Guests'}
            </h3>
            {others.length === 0 ? (
              <p className="text-xs text-gray-400">All guests are assigned to a room.</p>
            ) : (
              <ul className="space-y-1">
                {others.map((g) => (
                  <li key={g.id} className="flex items-center justify-between text-sm text-gray-700">
                    <span>{g.name}</span>
                    {g.roomId ? (
                      <button
                        type="button"
                        onClick={() => onUnassign(g.id)}
                        className="text-xs text-amber-600 hover:underline"
                      >
                        {g.roomId} · clear
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">No room</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
