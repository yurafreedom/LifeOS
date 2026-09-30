import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ClarifyPanel } from '../components/ClarifyPanel.jsx';
import { QuickNotesPage } from '../pages/QuickNotesPage.jsx';
import { TasksPage } from '../pages/TasksPage.jsx';
import { LifeLocaleContext, LifeLocales, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';

const NOTE = { id: 101, text: 'позвонить в банк — заблокировать старую карту', at: '09:14' };

function source(relative) {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

function withLocale(locale, node) {
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), themeEff: 'dark' }}>
      {node}
    </LifeLocaleContext.Provider>,
  );
}

function panelMarkup(locale = 'ru') {
  return withLocale(locale, (
    <ClarifyPanel
      note={NOTE}
      onClose={vi.fn()}
      onDoNow={vi.fn()}
      onDelegate={vi.fn()}
      onDefer={vi.fn()}
      onProject={vi.fn()}
      onReference={vi.fn()}
      onDelete={vi.fn()}
    />
  ));
}

describe('Clarify panel · handoff layout 1c', () => {
  it('renders the panel frame from the handoff on the production modal chrome', () => {
    const html = panelMarkup();
    expect(html).toContain('class="qa-backdrop clarify-backdrop"');
    expect(html).toContain('class="qa-modal clarify-panel"');
    expect(html).toContain('входящие → прояснить');
    expect(html).toContain(NOTE.text);
    expect(html).toContain('захвачено · 09:14');
    expect(html).toContain('займёт &lt; 2 мин? сделай сейчас.');
    expect(html).toContain('выбери исход');
    expect(html).toContain('gtd · прояснить');
    expect(html).toContain('>esc<');
  });

  it('renders exactly the six outcomes, in handoff order, each with icon + label + copy', () => {
    const html = panelMarkup();
    const labels = [
      ['сделать сейчас', 'закрой за пару минут'],
      ['делегировать', 'передай и жди ответа'],
      ['отложить', 'вернись к этому позже'],
      ['в проект', 'многошаговое дело'],
      ['в справочник', 'просто хранить, без действия'],
      ['удалить', 'это не нужно'],
    ];
    labels.forEach(([label, hint]) => {
      expect(html).toContain(label);
      expect(html).toContain(hint);
    });
    const positions = labels.map(([label]) => html.indexOf(`>${label}<`));
    expect(positions.every(index => index > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html.match(/class="clarify-row(?: is-[a-z]+)*"/g)).toHaveLength(6);
    /* Meaning is never colour-only: row 1 and row 6 both carry an icon and
       explanatory copy alongside their tint. */
    expect(html).toContain('clarify-row is-primary');
    expect(html).toContain('clarify-row is-danger');
  });

  it('exposes accessible dialog semantics and an accessible close control', () => {
    const html = panelMarkup();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="clarify-eyebrow clarify-title"');
    expect(html).toContain('id="clarify-eyebrow"');
    expect(html).toContain('id="clarify-title"');
    expect(html).toContain('aria-label="закрыть"');
    expect(html).toContain('aria-labelledby="clarify-choose"');
  });

  it('does not delete or defer before the required second step', () => {
    const html = panelMarkup();
    /* Neither expansion is armed on open. */
    expect(html).not.toContain('clarify-confirm');
    expect(html).not.toContain('clarify-defer');
    expect(html).not.toContain('удалить эту заметку?');
    expect(html).not.toContain('удалить навсегда');
    /* Both destructive/validating rows advertise themselves as expandable and
       point at the region they reveal. */
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(2);
    expect(html).toContain('aria-controls="clarify-panel-defer"');
    expect(html).toContain('aria-controls="clarify-panel-confirm-delete"');
  });

  it('guards Delete against a stale source note instead of claiming success', () => {
    /* The Clarify handlers live in app/clarifyHandlers.js; AppShell wires them. */
    const handlers = source('../app/clarifyHandlers.js');
    expect(handlers).toMatch(
      /onDelete\(note\) \{[\s\S]{0,300}requireClarifiableQuickNote\(note\.id\);[\s\S]{0,120}deleteQuickNote\(note\.id\)/,
    );
    expect(source('../App.jsx')).toContain('createClarifyHandlers({ data, t, showToast })');
    const provider = source('../context/LifeDataContext.jsx');
    expect(provider).toContain('function requireClarifiableQuickNote(noteId)');
    expect(provider).toContain('requireClarifiableQuickNote,');
    /* Delete keeps using the existing Quick Note deletion capability. */
    expect(provider).toContain('function deleteQuickNote(id)');
  });

  it('keeps focus, escape, digit-shortcut and double-submit behaviour in the component', () => {
    const code = source('../components/ClarifyPanel.jsx');
    /* Escape collapses an expansion first, then closes — never mutating. */
    expect(code).toContain("if (step !== 'idle') { setStep('idle'); setError(null); return; }");
    /* Initial focus on the first action, focus returned to the opener. */
    expect(code).toContain('firstActionRef.current && firstActionRef.current.focus()');
    expect(code).toContain('returnFocusRef.current = document.activeElement;');
    /* Tab wraps; Escape still exits, so this is not a keyboard trap. */
    expect(code).toContain("if (event.key === 'Tab')");
    /* Digits 1–6 are ignored while typing in a field. */
    expect(code).toContain("if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;");
    expect(code).toContain("const index = '123456'.indexOf(event.key);");
    /* One in-flight transition at a time. */
    expect(code).toContain('if (busyRef.current) return;');
    /* The panel closes only after the transition resolved. */
    expect(code).toContain('await action();\n      onClose();');
    /* No raw English Error text ever reaches the UI. */
    expect(code).toContain("setError(t(key || 'clarify_failed'));");
  });

  it('never routes the Project outcome through the Goal domain', () => {
    const panel = source('../components/ClarifyPanel.jsx');
    const app = source('../App.jsx');
    const domain = source('../domain/clarify.ts');
    const provider = source('../context/LifeDataContext.jsx');
    [panel, app, domain].forEach(code => {
      expect(code).not.toMatch(/addGoal|goals\[/);
    });
    expect(provider).toContain('clarifyQuickNoteToProject');
    expect(provider).toMatch(/function clarifyQuickNoteToProject[\s\S]{0,320}createProjectRecord/);
    expect(provider).not.toMatch(/function clarifyQuickNoteToProject[\s\S]{0,320}addGoal/);
  });
});

describe('Clarify · Quick Notes surface', () => {
  it('opens Clarify from the note row instead of a pre-filled Quick Add', () => {
    const html = withLocale('ru', (
      <QuickNotesPage notes={[NOTE]} references={[]} onAdd={vi.fn()} onClarify={vi.fn()} />
    ));
    expect(html).toContain('class="qn-item-open"');
    expect(html).toContain('прояснить заметку');
    expect(html).toContain(NOTE.text);
    /* The old promote-to-Quick-Add affordance is gone from this surface. */
    expect(html).not.toContain('превратить в задачу');

    const code = source('../App.jsx');
    expect(code).toContain('onClarify={(note) => setClarify(note)}');
    expect(code).not.toContain('fromNoteId: note.id');
  });

  it('shows the References retrieval surface with the preserved original text', () => {
    const html = withLocale('ru', (
      <QuickNotesPage
        notes={[]}
        references={[{ id: 'reference-1', text: 'ссылка на статью про CYP2D6', created_at: '2026-09-28T09:14:00.000Z' }]}
        onAdd={vi.fn()}
        onClarify={vi.fn()}
      />
    ));
    expect(html).toContain('справочник');
    expect(html).toContain('ссылка на статью про CYP2D6');
    expect(html).toContain('2026-09-28');
  });

  it('states truthfully that the References area is empty', () => {
    const html = withLocale('ru', (
      <QuickNotesPage notes={[NOTE]} references={[]} onAdd={vi.fn()} onClarify={vi.fn()} />
    ));
    expect(html).toContain('в справочнике пусто');
  });
});

describe('Clarify · Waiting retrieval surface', () => {
  const WAITING = [
    { id: 'waiting-1', title: 'счёт от подрядчика', waiting_for: 'Аня', created_at: '2026-09-28T09:14:00.000Z' },
    { id: 'waiting-2', title: 'ответ из банка', waiting_for: null, created_at: '2026-09-27T09:14:00.000Z' },
  ];

  it('offers a Waiting filter inside the existing Tasks experience', () => {
    const html = withLocale('ru', (
      <TasksPage tasks={[]} waitingItems={WAITING} onToggle={vi.fn()} onAdd={vi.fn()} onOpen={vi.fn()} />
    ));
    expect(html).toContain('<option value="waiting">ожидание</option>');
    expect(html).toContain('class="tasks-filter-select"');
  });

  it('renders Waiting items as their own records, not as tasks or task tags', () => {
    const code = source('../pages/TasksPage.jsx');
    expect(code).toContain('waiting-list');
    expect(code).toContain('item.waiting_for');
    /* Waiting rows never reuse task-row / task-check / task-tag markup. */
    const waitingBlock = code.slice(code.indexOf('waiting-list'), code.indexOf('</ul>'));
    expect(waitingBlock).not.toContain('task-row');
    expect(waitingBlock).not.toContain('task-check');
    expect(waitingBlock).not.toContain('task-tag');
    /* Waiting is not derived from tasks — it is its own collection prop. */
    expect(code).toContain('function TasksPage({ tasks, waitingItems = [], onToggle, onAdd, onOpen })');
  });

  it('keeps the ordinary task filters working and untouched', () => {
    const tasks = [
      { id: 1, title: 'важное', done: false, stakes: true, tag: 'today', due: '17:00' },
      { id: 2, title: 'рутина', done: false, stakes: false, tag: null, due: '' },
    ];
    const html = withLocale('ru', (
      <TasksPage tasks={tasks} waitingItems={WAITING} onToggle={vi.fn()} onAdd={vi.fn()} onOpen={vi.fn()} />
    ));
    /* Default filter is "all": both tasks render, no waiting list. */
    expect(html).toContain('важное');
    expect(html).toContain('рутина');
    expect(html).not.toContain('waiting-list');
    /* A Clarify-created task carries no invented category chip. */
    expect(html).not.toContain('class="task-tag"><span');
  });
});

describe('Clarify · localisation', () => {
  it('ships every new user-facing string in both ru and uk, and adds no English locale', () => {
    expect(LifeLocales).toEqual(['ru', 'uk']);
    expect(LifeStrings.en).toBeUndefined();
    const isNew = key => /^(clarify_|waiting_|reference_|qn_clarify)/.test(key)
      || key === 'tasks_filter_waiting';
    const ru = Object.keys(LifeStrings.ru).filter(isNew);
    const uk = Object.keys(LifeStrings.uk).filter(isNew);
    expect(ru.length).toBeGreaterThan(30);
    expect([...uk].sort()).toEqual([...ru].sort());
    ru.forEach(key => {
      expect(typeof LifeStrings.ru[key]).toBe('string');
      expect(LifeStrings.ru[key].trim()).not.toBe('');
      expect(typeof LifeStrings.uk[key]).toBe('string');
      expect(LifeStrings.uk[key].trim()).not.toBe('');
      /* uk must be a real translation, not a copy of ru — allow only the few
         strings that are genuinely identical across both languages. */
      if (!['clarify_foot', 'clarify_delete', 'clarify_two_minute_hint'].includes(key)) {
        expect(LifeStrings.uk[key]).not.toBe(LifeStrings.ru[key]);
      }
    });
  });

  it('renders the panel with no hardcoded Latin copy under uk', () => {
    const html = panelMarkup('uk');
    expect(html).toContain('вхідні → прояснити');
    expect(html).toContain('зробити зараз');
    expect(html).toContain('делегувати');
    expect(html).toContain('відкласти');
    expect(html).toContain('у проєкт');
    expect(html).toContain('у довідник');
    expect(html).toContain('видалити');
    expect(html).not.toContain('сделать сейчас');
  });
});

describe('Clarify · scope containment', () => {
  it('introduces no Adaptive Analytics coupling', () => {
    const domain = source('../domain/clarify.ts');
    const panel = source('../components/ClarifyPanel.jsx');
    const notes = source('../pages/QuickNotesPage.jsx');
    /* Clarify writes operational snapshot state only. It must not reach the AA
       repository, queue, context or fact builders. The shared IANA timezone
       helper lives under analytics/ but carries no AA semantics. */
    [domain, panel, notes].forEach(code => {
      expect(code).not.toMatch(/AnalyticsContext|analyticsRepository|analyticsWriteQueue/);
      expect(code).not.toMatch(/analyticsSyncCoordinator|projectFacts|financeTransaction/);
      expect(code).not.toMatch(/enqueue|aa_|measurement|forecast/i);
    });
    expect(domain).toContain("from '../analytics/timezone'");
    /* The Clarify provider actions emit no AA fact either. */
    const provider = source('../context/LifeDataContext.jsx');
    const clarifyBlock = provider.slice(
      provider.indexOf('function clarifyQuickNoteToTask'),
      provider.indexOf('/* ── Profile'),
    );
    expect(clarifyBlock.length).toBeGreaterThan(400);
    expect(clarifyBlock).not.toMatch(/analytics|enqueue/i);
  });

  it('leaves the global Quick Add path intact', () => {
    const app = source('../App.jsx');
    expect(app).toContain('function addTaskFromUI(');
    expect(app).toContain('<QuickAddModal');
    expect(app).toContain("if ((e.metaKey || e.ctrlKey) && e.key === 'k')");
    expect(app).toContain('onQuickAdd={() => openQuickAdd(false)}');
    const quickAdd = source('../components/QuickAddModal.jsx');
    expect(quickAdd).not.toMatch(/clarify/i);
  });
});
