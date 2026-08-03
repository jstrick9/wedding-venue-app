import { describe, expect, it } from 'vitest';
import { computeEventDashboard } from './eventDashboard';

const spec = (id: string, capacity: number, opts: { seating?: boolean } = {}) => ({
  id,
  capacity,
  isSeatingType: opts.seating,
}) as any;

describe('computeEventDashboard', () => {
  const guests = [
    { id: 'g1', name: 'A', rsvpStatus: 'confirmed', tableId: 't1' },
    { id: 'g2', name: 'B', rsvpStatus: 'confirmed', tableId: 't1' },
    { id: 'g3', name: 'C', rsvpStatus: 'pending', tableId: 't2' },
    { id: 'g4', name: 'D', rsvpStatus: 'declined', tableId: 't2' },
  ] as any;

  it('computes counts, response rate, and seating utilization', () => {
    const tables = [
      { id: 't1', specId: 'round', customCapacity: 6 },
      { id: 't2', specId: 'round', customCapacity: 6 },
    ] as any;

    const dash = computeEventDashboard(guests, [], tables, [spec('round', 8)]);

    expect(dash.totalGuests).toBe(4);
    expect(dash.confirmed).toBe(2);
    expect(dash.pending).toBe(1);
    expect(dash.declined).toBe(1);
    expect(dash.responseRate).toBe(75); // (2 confirmed + 1 declined) / 4
    expect(dash.totalSeats).toBe(12);
    expect(dash.seatingUtilization).toBe(Math.round((2 / 12) * 100));
    expect(dash.overCapacity).toBe(false);
    expect(dash.health).toBe('ready');
  });

  it('flags over-capacity when confirmed guests exceed total seats', () => {
    const tables = [{ id: 't1', specId: 'round', customCapacity: 1 }] as any;
    const dash = computeEventDashboard(guests, [], tables, [spec('round', 8)]);
    expect(dash.overCapacity).toBe(true);
    expect(dash.health).toBe('warning');
    expect(dash.messages.some((m) => m.includes('exceed'))).toBe(true);
  });

  it('excludes seating-type rows from table seat capacity', () => {
    const tables = [
      { id: 't1', specId: 'round', customCapacity: 8 },
      { id: 'rows', specId: 'ceremony', customCapacity: 12 },
    ] as any;
    const dash = computeEventDashboard(guests, [], tables, [
      spec('round', 8),
      spec('ceremony', 12, { seating: true }),
    ]);
    expect(dash.totalSeats).toBe(8); // ceremony seating rows excluded
  });

  it('reports low response rate', () => {
    const noResponse = [
      { id: 'g1', name: 'A', rsvpStatus: 'pending' },
    ] as any;
    const dash = computeEventDashboard(noResponse, [], [], []);
    expect(dash.responseRate).toBe(0);
    expect(dash.health).toBe('attention');
    expect(dash.messages.some((m) => m.includes('response rate'))).toBe(true);
  });

  it('handles an empty guest list gracefully', () => {
    const dash = computeEventDashboard([], [], [], []);
    expect(dash.totalGuests).toBe(0);
    expect(dash.responseRate).toBe(0);
    expect(dash.messages.some((m) => m.includes('No guests'))).toBe(true);
  });
});
