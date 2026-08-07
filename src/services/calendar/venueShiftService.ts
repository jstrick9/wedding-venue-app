import { StaffShift, VenueCalendarEvent } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { emitDataChanged } from '../../utils/appEvents';

function readShifts(): StaffShift[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STAFF_SHIFTS);
    return raw ? (JSON.parse(raw) as StaffShift[]) : [];
  } catch {
    return [];
  }
}

function writeShifts(shifts: StaffShift[]): void {
  localStorage.setItem(STORAGE_KEYS.STAFF_SHIFTS, JSON.stringify(shifts));
  emitDataChanged('all');
}

/** All staff shifts. */
export function getStaffShifts(): StaffShift[] {
  return readShifts();
}

/** Shifts linked to a specific calendar event. */
export function getShiftsForCalendarEvent(calendarEventId: string): StaffShift[] {
  return readShifts().filter((s) => s.calendarEventId === calendarEventId);
}

/**
 * Link the assigned staff of a calendar event to shifts for that event, using
 * the event's date + times. Creates one shift per assigned staff member (if not
 * already linked) so the event drives staffing.
 */
export function syncShiftsForCalendarEvent(ev: VenueCalendarEvent): void {
  const start = ev.startTime ? `${ev.date}T${ev.startTime}:00` : `${ev.date}T12:00:00`;
  const end = ev.endTime ? `${ev.date}T${ev.endTime}:00` : undefined;
  const assignees = ev.assignees || [];
  const shifts = readShifts();
  let changed = false;

  // Remove shifts for assignees no longer on the event (or when there are none).
  const kept = shifts.filter((s) => {
    if (s.calendarEventId !== ev.id) return true;
    return assignees.includes(s.staffId);
  });
  if (kept.length !== shifts.length) {
    changed = true;
  }

  // Add shifts for new assignees, and refresh time/role/name/notes on existing ones.
  const next = [...kept];
  assignees.forEach((staffId) => {
    const idx = next.findIndex(
      (s) => s.calendarEventId === ev.id && s.staffId === staffId,
    );
    if (idx >= 0) {
      const cur = next[idx];
      const role = ev.category === 'couple' ? 'coordinator' : ev.category === 'staffing' ? 'other' : 'other';
      if (cur.startTime !== start || cur.endTime !== (end || start) || cur.role !== role || cur.eventName !== ev.title || cur.notes !== ev.notes) {
        next[idx] = { ...cur, startTime: start, endTime: end || start, role, eventName: ev.title, notes: ev.notes };
        changed = true;
      }
      return;
    }
    next.push({
      id: `shift-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      staffId,
      role: ev.category === 'couple' ? 'coordinator' : ev.category === 'staffing' ? 'other' : 'other',
      startTime: start,
      endTime: end || start,
      calendarEventId: ev.id,
      eventName: ev.title,
      notes: ev.notes,
    });
    changed = true;
  });

  if (changed) writeShifts(next);
}

/** Remove shifts linked to a calendar event (on event delete). */
export function removeShiftsForCalendarEvent(calendarEventId: string): void {
  writeShifts(readShifts().filter((s) => s.calendarEventId !== calendarEventId));
}
