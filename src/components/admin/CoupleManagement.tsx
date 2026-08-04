import React, { useState } from 'react';
import type { AdminCommonProps } from './AdminTabTypes';
import {
  CoupleEvent,
} from '../../types';
import {
  getCoupleEvents,
  createCoupleEvent,
  deleteCoupleEvent,
  updateCoupleEvent,
} from '../../services/couples/coupleService';

interface CoupleManagementProps {
  config: AdminCommonProps['config'];
  venues: AdminCommonProps['venues'];
  user: AdminCommonProps['user'];
  onShowSuccess: (msg: string) => void;
}

/**
 * Couples & Events — venue-side management of booked couples. The venue creates a
 * couple event (booking), which generates an invitation link the couple uses to
 * open their own couples portal. This is the foundation for the multi-couple
 * platform; space selection, questions, approvals, and per-couple guest portals
 * layer on from here.
 */
export function CoupleManagement({ config, venues, user, onShowSuccess }: CoupleManagementProps) {
  const [events, setEvents] = useState<CoupleEvent[]>(() => getCoupleEvents());
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    coupleName: '',
    eventDate: '',
    guestCount: '',
    availableSpaces: [] as string[],
  });
  const [error, setError] = useState('');

  const refresh = () => setEvents(getCoupleEvents());

  const portalUrl = (token: string) =>
    `${window.location.origin}${window.location.pathname}#/couples-portal?token=${encodeURIComponent(token)}`;

  const handleCopy = (token: string) => {
    void navigator.clipboard?.writeText(portalUrl(token)).then(
      () => onShowSuccess('Invitation link copied to clipboard.'),
      () => {},
    );
  };

  const handleCreate = () => {
    if (!form.coupleName.trim()) {
      setError('Please enter the couple’s name.');
      return;
    }
    createCoupleEvent({
      coupleName: form.coupleName,
      eventDate: form.eventDate || undefined,
      guestCount: form.guestCount ? parseInt(form.guestCount, 10) || undefined : undefined,
      availableSpaces: form.availableSpaces,
      createdBy: user?.id,
    });
    setForm({ coupleName: '', eventDate: '', guestCount: '', availableSpaces: [] });
    setError('');
    setShowCreate(false);
    refresh();
    onShowSuccess('Couple event created. Send the invite link to the couple.');
  };

  const toggleSpace = (venueId: string) => {
    setForm((prev) => ({
      ...prev,
      availableSpaces: prev.availableSpaces.includes(venueId)
        ? prev.availableSpaces.filter((v) => v !== venueId)
        : [...prev.availableSpaces, venueId],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 p-4 text-white">
        <h2 className="text-base font-bold">💍 Couples &amp; Events</h2>
        <p className="text-xs text-white/80 mt-1">
          Create a booked couple's event and send them an invitation link to their own
          couples portal. They'll pick spaces, invite their planner/parents, and manage
          their guest portal.
        </p>
      </div>

      {/* Action */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          <strong>{events.length}</strong> couple event{events.length === 1 ? '' : 's'}
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700"
        >
          + New Couple Event
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl bg-white border border-gray-200 p-4 space-y-3 shadow-sm">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Couple name *</label>
            <input
              type="text"
              value={form.coupleName}
              onChange={(e) => setForm({ ...form, coupleName: e.target.value })}
              placeholder="e.g. Smith & Johnson"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Event date</label>
              <input
                type="date"
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Guest count</label>
              <input
                type="number"
                min={0}
                value={form.guestCount}
                onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
                placeholder="e.g. 120"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Spaces available to this couple
            </label>
            <div className="flex flex-wrap gap-2">
              {venues.map((v) => {
                const selected = form.availableSpaces.includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleSpace(v.id)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      selected
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-rose-300'
                    }`}
                  >
                    {v.name}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium"
            >
              Create Event
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {events.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center text-gray-500">
          <div className="text-4xl mb-3">💌</div>
          <p className="font-semibold text-gray-700">No couple events yet</p>
          <p className="text-sm mt-1">Create a couple event to invite your first booked couple.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.id} className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{ev.coupleName}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        ev.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {ev.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                    {ev.eventDate && <span>📅 {new Date(ev.eventDate).toLocaleDateString()}</span>}
                    {ev.guestCount && <span>👥 {ev.guestCount} guests</span>}
                    <span>🏛️ {ev.selectedSpaces.length}/{ev.availableSpaces.length} spaces</span>
                    <span>👥 {ev.collaborators.length} people</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(ev.inviteToken)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Copy invite
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.open(portalUrl(ev.inviteToken), '_blank');
                    }}
                    className="text-xs text-gray-600 hover:underline"
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete the event for ${ev.coupleName}?`)) {
                        deleteCoupleEvent(ev.id);
                        refresh();
                      }
                    }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {ev.collaborators.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 mb-1">Collaborators</div>
                  <div className="flex flex-wrap gap-2">
                    {ev.collaborators.map((c) => (
                      <span key={c.id} className="text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-700">
                        {c.name} ({c.role})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
