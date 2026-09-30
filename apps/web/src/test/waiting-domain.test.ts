import { describe, expect, it } from 'vitest';
import { buildInitialState, migrateStateCopy } from '../context/LifeDataContext.jsx';
import { applyClarifyTransition, createWaitingItemRecord, validateWaitingItemRecord } from '../domain/clarify';
import {
  activeWaitingItems,
  applyWaitingCommand,
  canRestoreWaiting,
  closedWaitingItems,
  commitWaitingCommand,
  validateWaitingLifecycle,
  type WaitingCommand,
  type WaitingOutcome,
} from '../domain/waiting';

type State = Record<string, any>;

const CREATED = '2026-09-28T09:14:00.000Z';
const T1 = '2026-09-30T10:00:00.000Z';
const T2 = '2026-09-30T11:30:00.000Z';

function legacyItem(id = 'waiting-1', title = 'счёт от подрядчика', person: string | null = null) {
  /* Exactly the four fields Clarify's Delegate has always written. */
  return createWaitingItemRecord(title, person, CREATED, id);
}

function stateWith(items: unknown[], extra: State = {}): State {
  return { ...(buildInitialState() as State), waitingItems: items, ...extra };
}

function applied(outcome: WaitingOutcome) {
  expect(outcome.status).toBe('applied');
  return outcome as Extract<WaitingOutcome, { status: 'applied' }> & { state: State };
}

const lastLog = (state: State) => state.activityLog[state.activityLog.length - 1];

describe('waiting lifecycle · edit', () => {
  it('edits title and person on an active record, trims, and logs the changed fields', () => {
    const state = stateWith([legacyItem()]);
    const result = applied(applyWaitingCommand(state, {
      kind: 'update', id: 'waiting-1', changes: { title: '  счёт от Ани  ', waiting_for: '  Аня ' },
    }, T1));

    expect(result.state.waitingItems[0]).toEqual({
      id: 'waiting-1', title: 'счёт от Ани', waiting_for: 'Аня', created_at: CREATED, updated_at: T1,
    });
    expect(lastLog(result.state)).toMatchObject({
      entity_type: 'waiting', entity_id: 'waiting-1', action: 'updated',
      details: { title: 'счёт от Ани', fields: ['title', 'waiting_for'] },
    });
    /* Input state is never mutated. */
    expect(state.waitingItems[0]).toEqual(legacyItem());
  });

  it('clears the person to null when emptied, and reports no-op edits as unchanged', () => {
    const state = stateWith([legacyItem('waiting-1', 'ответ из банка', 'Олег')]);
    const cleared = applied(applyWaitingCommand(state, { kind: 'update', id: 'waiting-1', changes: { waiting_for: '   ' } }, T1));
    expect(cleared.state.waitingItems[0].waiting_for).toBeNull();

    const same = applyWaitingCommand(state, {
      kind: 'update', id: 'waiting-1', changes: { title: 'ответ из банка ', waiting_for: 'Олег' },
    }, T1);
    expect(same.status).toBe('unchanged');
    expect(same.state).toBe(state);
  });

  it('rejects an empty title without touching state', () => {
    const state = stateWith([legacyItem()]);
    for (const title of ['', '   ', null]) {
      const result = applyWaitingCommand(state, { kind: 'update', id: 'waiting-1', changes: { title } }, T1);
      expect(result).toMatchObject({ status: 'invalid', code: 'empty_title' });
      expect(result.state).toBe(state);
    }
  });

  it('does not edit a closed record', () => {
    const closed = { ...legacyItem(), resolution: 'received', resolved_at: T1 };
    const result = applyWaitingCommand(stateWith([closed]), { kind: 'update', id: 'waiting-1', changes: { title: 'x' } }, T2);
    expect(result).toMatchObject({ status: 'invalid', code: 'not_active' });
  });
});

describe('waiting lifecycle · received / cancelled / restore', () => {
  it.each(['received', 'cancelled'] as const)('closes as %s with a timestamp and keeps the record', resolution => {
    const state = stateWith([legacyItem('waiting-2'), legacyItem()]);
    const result = applied(applyWaitingCommand(state, { kind: 'resolve', id: 'waiting-1', resolution }, T1));

    expect(result.state.waitingItems).toHaveLength(2);
    expect(result.state.waitingItems[1]).toMatchObject({ id: 'waiting-1', resolution, resolved_at: T1, updated_at: T1 });
    expect(result.state.waitingItems[1].converted_task_id).toBeUndefined();
    expect(activeWaitingItems(result.state.waitingItems).map(item => item.id)).toEqual(['waiting-2']);
    expect(closedWaitingItems(result.state.waitingItems).map(item => item.id)).toEqual(['waiting-1']);
    expect(lastLog(result.state)).toMatchObject({ entity_type: 'waiting', action: resolution });
    /* A waiting outcome never creates or completes a task. */
    expect(result.state.tasks).toBe(state.tasks);
  });

  it('applies pending edits together with the outcome in one transition', () => {
    const state = stateWith([legacyItem()]);
    const result = applied(applyWaitingCommand(state, {
      kind: 'resolve', id: 'waiting-1', resolution: 'received', changes: { waiting_for: 'Аня' },
    }, T1));
    expect(result.state.waitingItems[0]).toMatchObject({ waiting_for: 'Аня', resolution: 'received' });
    expect(result.state.activityLog.length).toBe(state.activityLog.length + 1);

    const bad = applyWaitingCommand(state, {
      kind: 'resolve', id: 'waiting-1', resolution: 'received', changes: { title: ' ' },
    }, T1);
    expect(bad).toMatchObject({ status: 'invalid', code: 'empty_title' });
    expect(bad.state).toBe(state);
  });

  it('treats a repeated outcome as already applied and a conflicting one as invalid', () => {
    const received = { ...legacyItem(), resolution: 'received', resolved_at: T1 };
    const state = stateWith([received]);
    expect(applyWaitingCommand(state, { kind: 'resolve', id: 'waiting-1', resolution: 'received' }, T2).status)
      .toBe('unchanged');
    expect(applyWaitingCommand(state, { kind: 'resolve', id: 'waiting-1', resolution: 'cancelled' }, T2))
      .toMatchObject({ status: 'invalid', code: 'not_active' });
    expect(applyWaitingCommand(state, { kind: 'resolve', id: 'waiting-1', resolution: 'converted' as never }, T2))
      .toMatchObject({ status: 'invalid', code: 'invalid_resolution' });
  });

  it.each(['received', 'cancelled'] as const)('restores a %s record with the same id and no resolution fields', resolution => {
    const closed = { ...legacyItem('waiting-1', 'ответ', 'Олег'), resolution, resolved_at: T1, updated_at: T1 };
    const result = applied(applyWaitingCommand(stateWith([closed]), { kind: 'restore', id: 'waiting-1' }, T2));
    expect(result.state.waitingItems[0]).toEqual({
      id: 'waiting-1', title: 'ответ', waiting_for: 'Олег', created_at: CREATED, updated_at: T2,
    });
    expect(lastLog(result.state)).toMatchObject({ action: 'restored', details: { from: resolution } });
    expect(() => validateWaitingLifecycle(result.state.waitingItems[0])).not.toThrow();
  });

  it('never restores a converted record, and restore of an active one is a no-op', () => {
    const converted = { ...legacyItem(), resolution: 'converted', resolved_at: T1, converted_task_id: 7 };
    expect(canRestoreWaiting(converted as never)).toBe(false);
    const state = stateWith([converted]);
    const result = applyWaitingCommand(state, { kind: 'restore', id: 'waiting-1' }, T2);
    expect(result).toMatchObject({ status: 'invalid', code: 'not_restorable' });
    expect(result.state).toBe(state);

    expect(applyWaitingCommand(stateWith([legacyItem()]), { kind: 'restore', id: 'waiting-1' }, T2).status)
      .toBe('unchanged');
  });
});

describe('waiting lifecycle · convert to task', () => {
  it('creates exactly one ordinary undated task and closes the record in ONE returned state', () => {
    const state = stateWith([legacyItem('waiting-1', 'договор от юриста', 'Ира')]);
    const before = state.tasks.length;
    const result = applied(applyWaitingCommand(state, { kind: 'convert', id: 'waiting-1', taskId: 1_900_000_000_000 }, T1));

    const task = result.state.tasks[result.state.tasks.length - 1];
    expect(result.state.tasks).toHaveLength(before + 1);
    expect(task).toEqual({
      id: 1_900_000_000_000, title: 'договор от юриста', done: false, stakes: false,
      tag: null, tagLabel: null, due: '', schedule: null, notes: '', created_at: T1,
    });
    /* The person stays on the closed Waiting record; no invented task notes. */
    expect(result.state.waitingItems[0]).toMatchObject({
      resolution: 'converted', resolved_at: T1, converted_task_id: task.id, waiting_for: 'Ира',
    });
    expect(result.task).toEqual(task);
    expect(result.state.activityLog.slice(-2)).toMatchObject([
      { entity_type: 'task', entity_id: task.id, action: 'created', details: { waiting_id: 'waiting-1' } },
      { entity_type: 'waiting', entity_id: 'waiting-1', action: 'converted', details: { task_id: task.id } },
    ]);
    expect(() => migrateStateCopy(result.state)).not.toThrow();
  });

  it('repeated activation creates no second task', () => {
    let state = stateWith([legacyItem()]);
    const command: WaitingCommand = { kind: 'convert', id: 'waiting-1', taskId: 1_900_000_000_000 };
    state = applied(applyWaitingCommand(state, command, T1)).state;
    const tasksAfterFirst = state.tasks.length;

    const again = applyWaitingCommand(state, { ...command, taskId: 1_900_000_000_999 }, T2);
    expect(again.status).toBe('unchanged');
    expect(again.state).toBe(state);
    expect(state.tasks).toHaveLength(tasksAfterFirst);
  });

  it('uses the edited title, never collides with an existing task id, and refuses closed records', () => {
    const state = stateWith([legacyItem()], { tasks: [{ id: 500, title: 'занято', done: false }] });
    const result = applied(applyWaitingCommand(state, {
      kind: 'convert', id: 'waiting-1', taskId: 500, changes: { title: 'позвонить подрядчику' },
    }, T1));
    expect(result.state.tasks.map((task: State) => task.id)).toEqual([500, 501]);
    expect(result.state.tasks[1].title).toBe('позвонить подрядчику');

    const cancelled = stateWith([{ ...legacyItem(), resolution: 'cancelled', resolved_at: T1 }]);
    const refused = applyWaitingCommand(cancelled, { kind: 'convert', id: 'waiting-1', taskId: 1 }, T2);
    expect(refused).toMatchObject({ status: 'invalid', code: 'not_active' });
    expect(refused.state).toBe(cancelled);
  });
});

describe('waiting lifecycle · delete and stale ids', () => {
  it('deletes permanently in any state and logs it', () => {
    const converted = { ...legacyItem('waiting-2'), resolution: 'converted', resolved_at: T1, converted_task_id: 9 };
    const state = stateWith([legacyItem(), converted]);
    const result = applied(applyWaitingCommand(state, { kind: 'delete', id: 'waiting-2' }, T2));
    expect(result.state.waitingItems.map((item: State) => item.id)).toEqual(['waiting-1']);
    expect(result.item).toBeNull();
    expect(lastLog(result.state)).toMatchObject({ action: 'deleted', details: { resolution: 'converted' } });
    /* Deleting the Waiting record never removes the Task it produced. */
    expect(result.state.tasks).toBe(state.tasks);
  });

  it.each<WaitingCommand>([
    { kind: 'update', id: 'gone', changes: { title: 'x' } },
    { kind: 'resolve', id: 'gone', resolution: 'received' },
    { kind: 'restore', id: 'gone' },
    { kind: 'convert', id: 'gone', taskId: 1 },
    { kind: 'delete', id: 'gone' },
  ])('a missing record is invalid, never applied ($kind)', command => {
    const state = stateWith([legacyItem()]);
    const result = applyWaitingCommand(state, command, T1);
    expect(result).toMatchObject({ status: 'invalid', code: 'missing' });
    expect(result.state).toBe(state);
  });

  it('reports an unloaded state as invalid', () => {
    expect(applyWaitingCommand(null, { kind: 'delete', id: 'x' }, T1)).toMatchObject({ status: 'invalid', code: 'state_missing' });
  });
});

describe('waiting lifecycle · validation', () => {
  it('accepts legacy four-field rows and every well-formed lifecycle shape', () => {
    for (const value of [
      legacyItem(),
      { ...legacyItem(), updated_at: T1 },
      { ...legacyItem(), resolution: 'received', resolved_at: T1 },
      { ...legacyItem(), resolution: 'cancelled', resolved_at: T1, updated_at: T1 },
      { ...legacyItem(), resolution: 'converted', resolved_at: T1, converted_task_id: 1_900_000_000_000 },
      { ...legacyItem(), resolution: 'converted', resolved_at: T1, converted_task_id: 'task-a' },
      { ...legacyItem(), resolution: null, resolved_at: null, converted_task_id: null },
    ]) {
      expect(() => validateWaitingLifecycle(value)).not.toThrow();
    }
  });

  it.each([
    [{ resolution: 'done', resolved_at: T1 }, /resolution is invalid/],
    [{ resolution: 'received' }, /together/],
    [{ resolved_at: T1 }, /together/],
    [{ resolution: 'received', resolved_at: 'yesterday' }, /resolved_at is invalid/],
    [{ updated_at: '2026-09-30' }, /updated_at is invalid/],
    [{ resolution: 'converted', resolved_at: T1 }, /must link its task/],
    [{ resolution: 'received', resolved_at: T1, converted_task_id: 3 }, /Only a converted/],
    [{ converted_task_id: 3 }, /Only a converted/],
    [{ resolution: 'converted', resolved_at: T1, converted_task_id: 1.5 }, /converted_task_id is invalid/],
    [{ resolution: 'converted', resolved_at: T1, converted_task_id: ' ' }, /converted_task_id is invalid/],
  ])('rejects malformed lifecycle fields %j', (fields, message) => {
    expect(() => validateWaitingLifecycle({ ...legacyItem(), ...fields })).toThrow(message);
  });
});

describe('waiting lifecycle · outcome is read from the state React applies, not a stale closure', () => {
  /* A minimal model of React's update queue: setState enqueues an updater;
     flush drains the queue in order. `strict` re-invokes each updater like
     StrictMode does in development. */
  function queue(initial: State, strict = false) {
    let current = initial;
    const pending: Array<(prev: State) => State> = [];
    return {
      get state() { return current; },
      setState(updater: (prev: State) => State) { pending.push(updater); },
      flush(run: () => void) {
        run();
        while (pending.length) {
          const updater = pending.shift()!;
          if (strict) updater(current);
          current = updater(current);
        }
      },
      /* Something else queued an update that has not been rendered yet. */
      enqueue(updater: (prev: State) => State) { pending.push(updater); },
    };
  }

  it('reports invalid (no task) when a queued update removed the record after the last render', () => {
    const renderTime = stateWith([legacyItem()]);
    const react = queue(renderTime);
    react.enqueue(prev => applied(applyWaitingCommand(prev, { kind: 'delete', id: 'waiting-1' }, T1)).state);

    const outcome = commitWaitingCommand(
      react.setState, react.flush, { kind: 'convert', id: 'waiting-1', taskId: 1_900_000_000_000 }, T1,
    );

    expect(outcome).toMatchObject({ status: 'invalid', code: 'missing' });
    expect(react.state.tasks).toHaveLength(renderTime.tasks.length);
  });

  it('two activations before a re-render create exactly one task; the second is not a success', () => {
    const react = queue(stateWith([legacyItem()]), true);
    const first = commitWaitingCommand(react.setState, react.flush, { kind: 'convert', id: 'waiting-1', taskId: 1_900_000_000_000 }, T1);
    const second = commitWaitingCommand(react.setState, react.flush, { kind: 'convert', id: 'waiting-1', taskId: 1_900_000_000_001 }, T1);

    expect(first.status).toBe('applied');
    expect(second.status).toBe('unchanged');
    expect(react.state.tasks.filter((task: State) => task.title === 'счёт от подрядчика')).toHaveLength(1);
  });

  it('is invalid, never successful, when the updater is not run (provider gone)', () => {
    const outcome = commitWaitingCommand(() => undefined, run => run(), { kind: 'delete', id: 'waiting-1' }, T1);
    expect(outcome).toMatchObject({ status: 'invalid', code: 'state_missing' });
  });
});

describe('waiting lifecycle · compatibility with the unchanged Clarify code path', () => {
  it('Clarify validation (shared with older clients) accepts lifecycle records', () => {
    const converted = { ...legacyItem(), resolution: 'converted', resolved_at: T1, converted_task_id: 5, updated_at: T1 };
    expect(() => validateWaitingItemRecord(converted)).not.toThrow();
  });

  it('a later Delegate keeps existing lifecycle fields byte-for-byte', () => {
    const closed = { ...legacyItem(), resolution: 'cancelled', resolved_at: T1, updated_at: T1 };
    const state = stateWith([closed], { quickNotes: [{ id: 42, text: 'новое делегирование', at: '10:00' }] });
    const next = applyClarifyTransition(state, 42, 'delegate', createWaitingItemRecord('новое делегирование', null, T2, 'waiting-new'));
    expect(next.waitingItems).toEqual([
      { id: 'waiting-new', title: 'новое делегирование', waiting_for: null, created_at: T2 },
      closed,
    ]);
  });
});
