import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WaitingItemModal, waitingDraftChanges, waitingOutcomeMessage } from '../components/WaitingItemModal.jsx';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeMakeT } from '../context/LocaleContext.jsx';
import { WaitingSection } from '../pages/TasksPage.jsx';

const CREATED = '2026-09-28T09:14:00.000Z';
const RESOLVED = '2026-09-30T10:00:00.000Z';

const ITEMS = [
  { id: 'w-active-1', title: 'счёт от подрядчика', waiting_for: 'Аня', created_at: CREATED },
  { id: 'w-active-2', title: 'ответ из банка', waiting_for: null, created_at: CREATED, updated_at: RESOLVED },
  { id: 'w-received', title: 'документы от нотариуса', waiting_for: 'Олег', created_at: CREATED,
    resolution: 'received', resolved_at: RESOLVED },
  { id: 'w-cancelled', title: 'звонок из сервиса', waiting_for: null, created_at: CREATED,
    resolution: 'cancelled', resolved_at: '2026-09-29T08:00:00.000Z' },
  { id: 'w-converted', title: 'договор от юриста', waiting_for: 'Ира', created_at: CREATED,
    resolution: 'converted', resolved_at: '2026-09-29T21:30:00.000Z', converted_task_id: 1_900_000_000_000 },
];

function render(locale, node) {
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale, t: LifeMakeT(locale), themeEff: 'dark' }}>
      <LifeDataContext.Provider value={{ runWaitingCommand: vi.fn() }}>{node}</LifeDataContext.Provider>
    </LifeLocaleContext.Provider>,
  );
}

const count = (html, needle) => html.split(needle).length - 1;

function modal(locale, item) {
  return render(locale, (
    <WaitingItemModal item={item} t={LifeMakeT(locale)} intlLocale={locale === 'uk' ? 'uk-UA' : 'ru-RU'}
                      onCommand={vi.fn()} onClose={vi.fn()} onDone={vi.fn()} />
  ));
}

describe('Tasks → Waiting · active and closed lists', () => {
  it('shows only active records as openable rows, with the active count, and keeps «закрыто» collapsed', () => {
    const html = render('ru', <WaitingSection waitingItems={ITEMS} />);
    expect(html).toContain('активно: 2');
    expect(count(html, 'class="waiting-title waiting-open"')).toBe(2);
    expect(count(html, 'aria-haspopup="dialog"')).toBe(2);
    expect(html).toContain('счёт от подрядчика');
    expect(html).toContain('от Аня');
    expect(html).not.toContain('документы от нотариуса');
    expect(html).toContain('закрыто · 3');
    expect(html).toMatch(/class="wt-closed-toggle mono" aria-expanded="false"/);
  });

  it('lists closed records newest first with localised outcome and date; restore only for received/cancelled', () => {
    const html = render('ru', <WaitingSection waitingItems={ITEMS} defaultClosedOpen />);
    const closed = html.slice(html.indexOf('id="tasks-waiting-closed"'));
    const order = ['документы от нотариуса', 'договор от юриста', 'звонок из сервиса'].map(title => closed.indexOf(title));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(closed).toContain('>получено<');
    expect(closed).toContain('>ожидание отменено<');
    expect(closed).toContain('>стало задачей<');
    expect(closed).toContain('30 сент. 2026');
    expect(count(closed, 'class="cal-act wt-restore"')).toBe(2);
    expect(closed).toContain('aria-label="вернуть в ожидание: документы от нотариуса"');
    expect(closed).not.toContain('aria-label="вернуть в ожидание: договор от юриста"');
  });

  it('shows a Kyiv calendar date for a late-evening UTC resolution', () => {
    /* 21:30Z on 29 Sep is 00:30 on 30 Sep in Europe/Kyiv. */
    const html = render('ru', <WaitingSection waitingItems={[ITEMS[4]]} defaultClosedOpen />);
    expect(html).toContain('30 сент. 2026');
  });

  it('says so when every record is closed', () => {
    const html = render('ru', <WaitingSection waitingItems={ITEMS.slice(2)} />);
    expect(html).toContain('активно: 0');
    expect(html).toContain('активных ожиданий нет.');
    expect(html).not.toContain('<ul class="waiting-list">');
  });

  it('renders the same surfaces in Ukrainian', () => {
    const html = render('uk', <WaitingSection waitingItems={ITEMS} defaultClosedOpen />);
    expect(html).toContain('активних: 2');
    expect(html).toContain('закрито · 3');
    expect(html).toContain('>отримано<');
    expect(html).toContain('>очікування скасовано<');
    expect(html).toContain('>стало завданням<');
    expect(html).toContain('>повернути<');
    expect(html).toContain('від Аня');
    expect(html).not.toMatch(/активно|закрыто|получено|вернуть/);
  });
});

describe('Waiting detail dialog', () => {
  it('edits an active record: title, person and every action, inside a modal dialog', () => {
    const html = modal('ru', ITEMS[0]);
    expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="wt-heading"/);
    expect(html).toContain('value="счёт от подрядчика"');
    expect(html).toContain('value="Аня"');
    for (const label of ['что ждём', 'от кого', 'получено', 'отменить ожидание', 'в задачу', 'удалить', 'сохранить', 'отмена']) {
      expect(html).toContain(`>${label}<`);
    }
    expect(html).toContain('<button type="submit" class="qa-btn-save">сохранить</button>');
    expect(html).not.toContain('>вернуть<');
    /* Delete is two-step: the confirmation is not armed on open. */
    expect(html).not.toContain('удалить навсегда');
  });

  it('shows a received record read-only with «вернуть» and no Save', () => {
    const html = modal('ru', ITEMS[2]);
    expect(html).toContain('>получено<');
    expect(html).toContain('>вернуть<');
    expect(html).toContain('от Олег');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('>сохранить<');
    expect(html).toContain('>удалить<');
  });

  it('never offers restore for a converted record and explains why', () => {
    const html = modal('uk', ITEMS[4]);
    expect(html).toContain('>стало завданням<');
    expect(html).not.toContain('>повернути<');
    expect(html).toContain('завдання вже створено');
    expect(html).toContain('>видалити<');
  });

  it('reports a record that disappeared instead of offering actions on it', () => {
    const html = modal('ru', undefined);
    expect(html).toContain('этой записи больше нет');
    expect(html).not.toContain('>удалить<');
    expect(html).not.toContain('>сохранить<');
  });
});

describe('Waiting outcome feedback', () => {
  const t = LifeMakeT('ru');
  const resolve = { kind: 'resolve', id: 'w', resolution: 'received' };

  it('announces success only for an applied outcome', () => {
    expect(waitingOutcomeMessage({ status: 'applied', item: null }, resolve, t, 'x'))
      .toEqual({ tone: 'ok', text: 'отмечено: получено' });
    expect(waitingOutcomeMessage({ status: 'applied', item: {}, task: { title: 'договор' } },
      { kind: 'convert', id: 'w' }, t, 'старое')).toEqual({ tone: 'ok', text: 'создана задача без даты · «договор»' });
    expect(waitingOutcomeMessage({ status: 'unchanged' }, resolve, t, 'x').tone).toBe('info');
    expect(waitingOutcomeMessage({ status: 'invalid', code: 'missing' }, resolve, t, 'x'))
      .toEqual({ tone: 'error', text: 'этой записи больше нет: её удалили или изменили в другом месте.' });
    expect(waitingOutcomeMessage(null, resolve, t, 'x').tone).toBe('error');
  });

  it('maps every domain error code to real copy in both locales', () => {
    for (const locale of ['ru', 'uk']) {
      const tl = LifeMakeT(locale);
      for (const code of ['state_missing', 'missing', 'empty_title', 'invalid_person', 'invalid_resolution',
        'not_active', 'not_restorable', 'invalid_command', 'something_new']) {
        const { text } = waitingOutcomeMessage({ status: 'invalid', code }, resolve, tl, 'x');
        expect(text).not.toMatch(/^waiting_/);
      }
    }
  });

  it('detects draft edits against the stored record', () => {
    expect(waitingDraftChanges(ITEMS[1], { title: 'ответ из банка', person: '' })).toEqual({});
    expect(waitingDraftChanges(ITEMS[0], { title: 'счёт', person: '' })).toEqual({ title: 'счёт', waiting_for: '' });
  });
});
