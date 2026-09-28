import { describe, expect, it } from 'vitest';
import {
  ClarifyError,
  applyClarifyTransition,
  assertFutureDeferDate,
  createClarifiedTaskRecord,
  createDeferredTaskRecord,
  createReferenceRecord,
  createWaitingItemRecord,
  requireQuickNote,
  validateReferenceRecord,
  validateWaitingItemRecord,
} from '../domain/clarify';
import { createProjectRecord } from '../domain/projects';

const NOTE = { id: 101, text: 'позвонить в банк — заблокировать старую карту', at: '09:14' };

/* applyClarifyTransition returns an opaque snapshot by design — the domain does
   not own the shape of the whole state tree. Tests read it loosely. */
function transition(
  ...args: Parameters<typeof applyClarifyTransition>
): Record<string, any> {
  return applyClarifyTransition(...args) as Record<string, any>;
}

function baseState(overrides: Record<string, unknown> = {}): Record<string, any> {
  return {
    version: 2,
    tasks: [{ id: 1, titleKey: 'seed_task_ship', done: false, stakes: true, tag: 'today', due: 'eod' }],
    projects: [],
    goals: [{ id: 'g_existing', titleKey: 'goal_ship_v1', pct: 81 }],
    quickNotes: [{ ...NOTE }, { id: 102, text: 'вторая заметка', at: '11:02' }],
    waitingItems: [],
    references: [],
    activityLog: [],
    ...overrides,
  };
}

describe('Clarify · Do Now', () => {
  it('creates a normal open Task with no invented due date, schedule, stakes or category', () => {
    const task = createClarifiedTaskRecord(NOTE.text, 900);
    expect(task).toEqual({
      id: 900,
      title: NOTE.text,
      done: false,
      stakes: false,
      tag: null,
      tagLabel: null,
      due: '',
      schedule: null,
      notes: '',
    });
  });

  it('removes the source note in the same state update that creates the Task', () => {
    const previous = baseState();
    const task = createClarifiedTaskRecord(NOTE.text, 900);

    const next = transition(previous, NOTE.id, 'do_now', task);

    expect(next.tasks).toHaveLength(2);
    expect(next.tasks[1]).toBe(task);
    expect(next.quickNotes.map((n: any) => n.id)).toEqual([102]);
    /* Source tree untouched — the provider always hands React a new object. */
    expect(previous.tasks).toHaveLength(1);
    expect(previous.quickNotes).toHaveLength(2);
  });

  it('logs both the destination creation and the note transition atomically', () => {
    const next = transition(
      baseState(), NOTE.id, 'do_now', createClarifiedTaskRecord(NOTE.text, 900),
    );
    expect(next.activityLog).toHaveLength(2);
    expect(next.activityLog[0]).toMatchObject({
      entity_type: 'task', entity_id: 900, action: 'created',
      details: { title: NOTE.text, clarify_outcome: 'do_now' },
    });
    expect(next.activityLog[1]).toMatchObject({
      entity_type: 'quick_note', entity_id: 101, action: 'clarified',
      details: { outcome: 'do_now', destination_id: 900 },
    });
  });

  it('keeps the source note when the destination record cannot be built', () => {
    const previous = baseState();
    expect(() => createClarifiedTaskRecord('   ')).toThrow(/required/i);
    expect(previous.quickNotes).toHaveLength(2);
    expect(previous.tasks).toHaveLength(1);
  });
});

describe('Clarify · Delegate → Waiting', () => {
  it('creates a real Waiting record that is not a Task and not a tag', () => {
    const item = createWaitingItemRecord(NOTE.text, null, '2026-09-28T09:14:00.000Z', 'waiting-1');
    expect(item).toEqual({
      id: 'waiting-1',
      title: NOTE.text,
      waiting_for: null,
      created_at: '2026-09-28T09:14:00.000Z',
    });
    expect(validateWaitingItemRecord(item)).toBe(item);
  });

  it('stores an optional counterparty and normalises blanks to absent', () => {
    expect(createWaitingItemRecord('x', '  Аня  ', 0, 'w').waiting_for).toBe('Аня');
    expect(createWaitingItemRecord('x', '   ', 0, 'w').waiting_for).toBeNull();
  });

  it('lands in waitingItems only, leaving tasks and goals untouched', () => {
    const previous = baseState();
    const item = createWaitingItemRecord(NOTE.text, null, 0, 'waiting-1');

    const next = transition(previous, NOTE.id, 'delegate', item);

    expect(next.waitingItems).toEqual([item]);
    expect(next.tasks).toEqual(previous.tasks);
    expect(next.goals).toEqual(previous.goals);
    expect(next.quickNotes.map((n: any) => n.id)).toEqual([102]);
  });

  it('rejects malformed Waiting records at the validation boundary', () => {
    expect(() => validateWaitingItemRecord({ id: '', title: 'x', created_at: '2026-01-01T00:00:00Z' }))
      .toThrow(/id/i);
    expect(() => validateWaitingItemRecord({ id: 'w', title: '  ', created_at: '2026-01-01T00:00:00Z' }))
      .toThrow(/title/i);
    expect(() => validateWaitingItemRecord({ id: 'w', title: 'x', created_at: 'not-a-date' }))
      .toThrow(/timestamp/i);
    expect(() => validateWaitingItemRecord({ id: 'w', title: 'x', created_at: '2026-01-01T00:00:00Z', waiting_for: 7 }))
      .toThrow(/counterparty/i);
    expect(() => validateWaitingItemRecord([])).toThrow(/invalid/i);
  });
});

describe('Clarify · Defer', () => {
  const NOW = '2026-09-28T21:30:00.000Z'; // 2026-09-29 00:30 in Europe/Kyiv (+03)

  it('requires an explicitly selected date', () => {
    expect(() => assertFutureDeferDate('', NOW)).toThrow(ClarifyError);
    expect(() => assertFutureDeferDate(undefined, NOW)).toThrowError(
      expect.objectContaining({ code: 'defer_missing' }),
    );
  });

  it('rejects a malformed or impossible date', () => {
    expect(() => assertFutureDeferDate('05.10.2026', NOW)).toThrowError(
      expect.objectContaining({ code: 'defer_invalid' }),
    );
    expect(() => assertFutureDeferDate('2026-02-30', NOW)).toThrowError(
      expect.objectContaining({ code: 'defer_invalid' }),
    );
  });

  it('rejects today and any past date using the Europe/Kyiv local day, not UTC', () => {
    /* At this instant UTC is still 2026-09-28 while Kyiv is already the 29th —
       so "2026-09-29" must be rejected as today, proving the IANA local date is
       what decides, with no hardcoded offset anywhere. */
    expect(() => assertFutureDeferDate('2026-09-29', NOW)).toThrowError(
      expect.objectContaining({ code: 'defer_past' }),
    );
    expect(() => assertFutureDeferDate('2026-09-28', NOW)).toThrowError(
      expect.objectContaining({ code: 'defer_past' }),
    );
    expect(assertFutureDeferDate('2026-09-30', NOW)).toBe('2026-09-30');
  });

  it('resolves the local day correctly in winter, when Kyiv is +02', () => {
    const winter = '2026-01-15T22:30:00.000Z'; // 2026-01-16 00:30 Kyiv
    expect(() => assertFutureDeferDate('2026-01-16', winter)).toThrowError(
      expect.objectContaining({ code: 'defer_past' }),
    );
    expect(assertFutureDeferDate('2026-01-17', winter)).toBe('2026-01-17');
  });

  it('creates a normal Task carrying the future date in the existing schedule shape', () => {
    const task = createDeferredTaskRecord(NOTE.text, '2026-10-05', NOW, 901);
    expect(task).toEqual({
      id: 901,
      title: NOTE.text,
      done: false,
      stakes: false,
      tag: null,
      tagLabel: null,
      due: '2026-10-05',
      schedule: { date: '2026-10-05', time: '' },
      notes: '',
    });
  });

  it('creates no Task at all when the selection is missing, invalid or past', () => {
    const previous = baseState();
    for (const bad of ['', '2026-09-28', 'сегодня', '2026-13-01']) {
      expect(() => createDeferredTaskRecord(NOTE.text, bad, NOW, 901)).toThrow(ClarifyError);
    }
    expect(previous.tasks).toHaveLength(1);
    expect(previous.quickNotes).toHaveLength(2);
  });

  it('removes the source note once a valid deferred Task exists', () => {
    const task = createDeferredTaskRecord(NOTE.text, '2026-10-05', NOW, 901);
    const next = transition(baseState(), NOTE.id, 'defer', task);
    expect(next.tasks[1]).toBe(task);
    expect(next.quickNotes.map((n: any) => n.id)).toEqual([102]);
  });
});

describe('Clarify · Project', () => {
  it('creates a real projects[] entry through the Slice P Project domain', () => {
    const project = createProjectRecord(NOTE.text, '2026-09-28T09:14:00.000Z', 'project-1');
    const previous = baseState();

    const next = transition(previous, NOTE.id, 'project', project);

    expect(next.projects).toEqual([{
      id: 'project-1',
      title: NOTE.text,
      created_at: '2026-09-28T09:14:00.000Z',
      started_at: '2026-09-28T09:14:00.000Z',
      status: 'active',
      current_forecast_date: null,
      completed_at: null,
    }]);
    expect(next.quickNotes.map((n: any) => n.id)).toEqual([102]);
  });

  it('never touches goals[]', () => {
    const previous = baseState();
    const next = transition(
      previous, NOTE.id, 'project', createProjectRecord(NOTE.text, 0, 'project-1'),
    );
    expect(next.goals).toBe(previous.goals);
    expect(next.goals).toEqual([{ id: 'g_existing', titleKey: 'goal_ship_v1', pct: 81 }]);
  });

  it('logs the destination as a project, not a goal', () => {
    const next = transition(
      baseState(), NOTE.id, 'project', createProjectRecord(NOTE.text, 0, 'project-1'),
    );
    expect(next.activityLog[0]).toMatchObject({ entity_type: 'project', entity_id: 'project-1' });
  });
});

describe('Clarify · Reference', () => {
  it('creates a persisted Reference preserving the original text verbatim', () => {
    const reference = createReferenceRecord(NOTE.text, '2026-09-28T09:14:00.000Z', 'reference-1');
    expect(reference).toEqual({
      id: 'reference-1',
      text: NOTE.text,
      created_at: '2026-09-28T09:14:00.000Z',
    });
    expect(validateReferenceRecord(reference)).toBe(reference);
  });

  it('removes the source note only after the Reference exists', () => {
    const previous = baseState();
    const reference = createReferenceRecord(NOTE.text, 0, 'reference-1');

    const next = transition(previous, NOTE.id, 'reference', reference);

    expect(next.references).toEqual([reference]);
    expect(next.quickNotes.map((n: any) => n.id)).toEqual([102]);
    expect(previous.references).toEqual([]);
    expect(previous.quickNotes).toHaveLength(2);
  });

  it('rejects malformed Reference records at the validation boundary', () => {
    expect(() => validateReferenceRecord({ id: 'r', text: '  ', created_at: '2026-01-01T00:00:00Z' }))
      .toThrow(/text/i);
    expect(() => validateReferenceRecord({ id: '', text: 'x', created_at: '2026-01-01T00:00:00Z' }))
      .toThrow(/id/i);
    expect(() => validateReferenceRecord(null)).toThrow(/invalid/i);
  });
});

describe('Clarify · stale and duplicate protection', () => {
  it('raises before writing anything when the source note is gone', () => {
    const state = baseState({ quickNotes: [] });
    expect(() => requireQuickNote(state, NOTE.id)).toThrowError(
      expect.objectContaining({ code: 'stale_note' }),
    );
  });

  it('raises when operational state is not loaded', () => {
    expect(() => requireQuickNote(null, NOTE.id)).toThrowError(
      expect.objectContaining({ code: 'state_missing' }),
    );
  });

  it('returns the previous state untouched when the note already left the inbox', () => {
    const previous = baseState({ quickNotes: [{ id: 102, text: 'вторая заметка', at: '11:02' }] });
    const next = transition(
      previous, NOTE.id, 'do_now', createClarifiedTaskRecord(NOTE.text, 900),
    );
    expect(next).toBe(previous);
  });

  it('is idempotent — a replayed transition cannot duplicate the destination', () => {
    const task = createClarifiedTaskRecord(NOTE.text, 900);
    const first = transition(baseState(), NOTE.id, 'do_now', task);
    /* Same destination id, note somehow still present: must not create twice. */
    const replayed = transition(
      { ...first, quickNotes: [{ ...NOTE }] }, NOTE.id, 'do_now', task,
    );
    expect(replayed.tasks).toHaveLength(2);
    expect(replayed.quickNotes).toHaveLength(1);
  });

  it('rejects an unknown outcome and a record without an id', () => {
    expect(() => applyClarifyTransition(baseState(), NOTE.id, 'nope' as never, { id: 1 }))
      .toThrow(/Unknown Clarify outcome/);
    expect(() => applyClarifyTransition(baseState(), NOTE.id, 'do_now', {}))
      .toThrow(/destination record is invalid/i);
  });

  it('refuses to operate on a snapshot whose collections are malformed', () => {
    expect(() => applyClarifyTransition(
      baseState({ references: {} }), NOTE.id, 'reference', createReferenceRecord('x', 0, 'r'),
    )).toThrow(/references/);
    expect(() => applyClarifyTransition(
      baseState({ waitingItems: null }), NOTE.id, 'delegate', createWaitingItemRecord('x', null, 0, 'w'),
    )).toThrow(/waitingItems/);
  });
});
