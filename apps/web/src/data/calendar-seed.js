

/* data/calendar-seed.js
 *
 * Sprint 3B · seed event pool to demonstrate the new pill density.
 *
 * Events are anchored to "this week" relative to today. The aggregator
 * in lib/calendar.js merges these with state.tasks, state.dog feeding
 * times, and (eventually) state.medications doses into per-day buckets.
 *
 * Shape:
 *   { dayOffset: -3..+3 from week-Mon, time: 'HH:MM',
 *     titleKey: i18n key, kind: 'stakes'|'routine'|'info',
 *     source: 'task'|'health'|'work'|'social'|'bill'|'med',
 *     metaKey?: optional second-line key for DayDetailModal }
 *
 * dayOffset is 0-based against Monday of the current display week. We
 * intentionally seed two days near max density so the "+N ещё"
 * overflow + DayDetailModal are visible by default.
 */

const LifeCalendarSeed = [
  /* Monday — sparse */
  { dayOffset: 0, time: '09:00', titleKey: 'cal_seed_standup',  kind: 'routine', source: 'work' },
  { dayOffset: 0, time: '14:00', titleKey: 'cal_seed_walk',     kind: 'info',    source: 'health' },
  { dayOffset: 0, time: '17:30', titleKey: 'cal_seed_gym',      kind: 'routine', source: 'health' },

  /* Tuesday — medium */
  { dayOffset: 1, time: '08:30', titleKey: 'cal_seed_call_mum', kind: 'routine', source: 'social' },
  { dayOffset: 1, time: '11:00', titleKey: 'cal_seed_review_pr', kind: 'routine', source: 'work' },
  { dayOffset: 1, time: '15:00', titleKey: 'cal_seed_therapy',  kind: 'stakes',  source: 'health' },
  { dayOffset: 1, time: '19:00', titleKey: 'cal_seed_dinner_a', kind: 'info',    source: 'social' },

  /* Wednesday — DENSE (9 events → triggers overflow) */
  { dayOffset: 2, time: '07:00', titleKey: 'cal_seed_run',       kind: 'routine', source: 'health' },
  { dayOffset: 2, time: '09:00', titleKey: 'cal_seed_standup',   kind: 'routine', source: 'work' },
  { dayOffset: 2, time: '10:30', titleKey: 'cal_seed_design_rev',kind: 'routine', source: 'work' },
  { dayOffset: 2, time: '12:00', titleKey: 'cal_seed_lunch_x',   kind: 'info',    source: 'social' },
  { dayOffset: 2, time: '14:00', titleKey: 'cal_seed_ship_v1',   kind: 'stakes',  source: 'work' },
  { dayOffset: 2, time: '16:00', titleKey: 'cal_seed_one_on_one',kind: 'routine', source: 'work' },
  { dayOffset: 2, time: '17:30', titleKey: 'cal_seed_bill_rent', kind: 'info',    source: 'bill' },
  { dayOffset: 2, time: '18:30', titleKey: 'cal_seed_groceries', kind: 'info',    source: 'work' },
  { dayOffset: 2, time: '20:00', titleKey: 'cal_seed_vet_call',  kind: 'info',    source: 'health' },
  { dayOffset: 2, time: '21:00', titleKey: 'cal_seed_read',      kind: 'routine', source: 'work' },

  /* Thursday — medium */
  { dayOffset: 3, time: '09:30', titleKey: 'cal_seed_focus',     kind: 'routine', source: 'work' },
  { dayOffset: 3, time: '11:00', titleKey: 'cal_seed_q4_commit', kind: 'stakes',  source: 'work' },
  { dayOffset: 3, time: '14:00', titleKey: 'cal_seed_walk',      kind: 'info',    source: 'health' },
  { dayOffset: 3, time: '18:00', titleKey: 'cal_seed_dentist',   kind: 'stakes',  source: 'health' },

  /* Friday — medium */
  { dayOffset: 4, time: '09:00', titleKey: 'cal_seed_standup',   kind: 'routine', source: 'work' },
  { dayOffset: 4, time: '12:30', titleKey: 'cal_seed_lunch_team',kind: 'info',    source: 'social' },
  { dayOffset: 4, time: '15:00', titleKey: 'cal_seed_demo',      kind: 'stakes',  source: 'work' },
  { dayOffset: 4, time: '19:00', titleKey: 'cal_seed_movie',     kind: 'info',    source: 'social' },

  /* Saturday — sparse */
  { dayOffset: 5, time: '10:00', titleKey: 'cal_seed_run',       kind: 'routine', source: 'health' },
  { dayOffset: 5, time: '15:00', titleKey: 'cal_seed_dinner_a',  kind: 'info',    source: 'social' },

  /* Sunday — empty by design (demonstrates the "тихий день" feel) */
];

export { LifeCalendarSeed };
