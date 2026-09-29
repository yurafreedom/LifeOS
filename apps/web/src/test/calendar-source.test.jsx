import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* Source-level guards for the Calendar track (plan C27). */

const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('C27 · no UTC slicing of local dates in Calendar code', () => {
  it.each([
    '../domain/calendarModel.ts',
    '../domain/tasks.ts',
    '../pages/calendar/calendarRoute.js',
  ])('%s', file => {
    expect(read(file)).not.toMatch(/toISOString\(\)\.slice/);
  });
});
