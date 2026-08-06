import { StaffShift, VenueCalendarEvent } from '../../types';
import { STORAGE_KEYS } from '../../constants/storageKeys';

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
  try {
    window.dispatchEvent(new CustomEvent('spm_data_changed'));
  } catch {
    // ignore
  }
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
  if (!ev.assignees || ev.assignees.length === 0) return;
  const shifts = readShifts();
  let changed = false;
  const start = ev.startTime ? `${ev.date}T${ev.startTime}:00` : `${ev.date}T12:00:00`;
  const end = ev.endTime ? `${ev.date}T${ev.endTime}:00` : undefined;
  ev.assignees.forEach((staffId) => {
    const exists = shifts.some(
      (s) => s.calendarEventId === ev.id && s.staffId === staffId,
    );
    if (exists) return;
    shifts.push({
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
  if (changed) writeShifts(shifts);
}

/** Remove shifts linked to a calendar event (on event delete). */
export function removeShiftsForCalendarEvent(calendarEventId: string): void {
  writeShifts(readShifts().filter((s) => s.calendarEventId !== calendarEventId));
}
