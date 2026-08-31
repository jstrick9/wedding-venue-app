import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Review #253 (campaign unit 1.13): pins the VenueCalendar.tsx defects
 * found when it left `@ts-nocheck`.
 *
 * F-253-1 (P1 runtime bug — fixed): the CalendarEventForm sub-component
 * referenced `config` (branding) without defining or receiving it. The Save
 * button's style evaluates `config.primaryColor` on every render, so
 * opening the add/edit event form threw `ReferenceError: config is not
 * defined` and crashed the component tree. The fix gives the sub-component
 * its own `useBrandingConfig()` call (same hook the parent already used).
 *
 * F-253-2 (P4 display bug — fixed): EventItem carried `startTime` but not
 * `endTime`, and venueItems never copied it, so the detail panel's
 * "start – end" branch never showed an end time even when the event had
 * one. `endTime` is now on the interface and copied at construction.
 */
describe('VenueCalendar typing fixes (Review #253)', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/VenueCalendar.tsx'), 'utf8');

  it('CalendarEventForm defines config in its own scope (F-253-1)', () => {
    // The sub-component's body (from its declaration to the next function)…
    const formStart = source.indexOf('function CalendarEventForm(');
    expect(formStart).toBeGreaterThan(-1);
    const formBlock = source.slice(formStart, source.indexOf('\nfunction ', formStart + 1));
    // …obtains branding via the hook instead of referencing an ambient name…
    expect(formBlock).toMatch(/^ {2}const config = useBrandingConfig\(\);$/m);
    // …and the file still imports the hook.
    expect(source).toMatch(/^import \{ useBrandingConfig \} from '\.\.\/config';$/m);
  });

  it('EventItem carries endTime and venueItems copies it (F-253-2)', () => {
    const ifaceStart = source.indexOf('interface EventItem {');
    expect(ifaceStart).toBeGreaterThan(-1);
    const iface = source.slice(ifaceStart, source.indexOf('}', ifaceStart));
    expect(iface).toMatch(/^ {2}endTime\?: string;$/m);
    expect(source).toMatch(/^ {4}endTime: e\.endTime,$/m);
  });
});
