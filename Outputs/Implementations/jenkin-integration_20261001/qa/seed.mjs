// Seeds the disposable lifeos_test QA account through the REAL API.
// Dates are relative to the live Europe/Kyiv day.
import { authContext, ensureInitialized, getState, launch, putState } from './lib.mjs';

function kyivToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function shift(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export const LONG_TITLE = 'Ёлка і Їжак: перевірити Іі Її Єє Ґґ та Ёё — дуже довга назва завдання, що має переноситися без горизонтального переповнення 0123456789 Надзвичайнодовгенеперервнеслово';

export async function seed() {
  const browser = await launch();
  const context = await authContext(browser);
  await ensureInitialized(context);
  const env = await getState(context);
  const today = kyivToday();
  const now = new Date().toISOString();
  const p = env.payload;
  const base = (id, title, extra = {}) => ({ id, title, done: false, stakes: false, tag: null, tagLabel: null, due: '', schedule: null, notes: '', created_at: '2026-09-20T09:00:00.000Z', ...extra });
  const on = (date, time = '') => ({ schedule: { date, time }, due: time || date });
  const qa = [
    base(9001, 'QA просроченная: сдать отчёт по кварталу', on(shift(today, -3))),
    base(9002, 'QA просроченная важная: позвонить в банк', { ...on(shift(today, -1), '09:00'), stakes: true, tag: 'today' }),
    base(9003, 'QA сегодня: забрать посылку на почте до закрытия отделения', on(today, '10:30')),
    base(9004, 'QA сегодня важная: оплатить аренду', { ...on(today), stakes: true, tag: 'today' }),
    base(9005, 'QA завтра: тренировка', on(shift(today, 1), '19:00')),
    base(9006, 'QA через неделю: записаться к врачу', on(shift(today, 6))),
    base(9007, 'QA без даты: разобрать почту'),
    base(9008, 'QA выполненная вчера', { ...on(shift(today, -2)), done: true, completed_at: now }),
    base(9009, 'QA в архиве', { ...on(shift(today, -4)), closure: 'archived', closed_at: now }),
    base(9010, 'QA закрыта без выполнения', { ...on(shift(today, -5)), closure: 'closed_unresolved', closed_at: now }),
    base(9011, 'QA високосный день', on('2028-02-29', '08:00')),
    base(9012, 'QA последний день 2100', on('2100-12-31')),
    base(9013, 'QA август: шесть недель', on('2026-08-15')),
    base(9014, 'QA прошлый год', on('2025-12-15')),
    base(9015, 'QA сегодня третья', on(today, '18:15')),
    base(9016, LONG_TITLE, { ...on(today), stakes: true }),
  ];
  p.tasks = [...(p.tasks || []).filter(t => !(Number(t.id) >= 9000 && Number(t.id) < 9100)), ...qa];
  p.waitingItems = [
    { id: 'waiting-qa-1', title: 'QA ответ от бухгалтера', waiting_for: 'Ольга', created_at: '2026-09-25T09:00:00.000Z' },
    { id: 'waiting-qa-2', title: 'QA подтверждение брони', waiting_for: null, created_at: '2026-09-27T09:00:00.000Z' },
    { id: 'waiting-qa-3', title: 'QA договор получен', waiting_for: 'юрист', created_at: '2026-09-20T09:00:00.000Z', resolution: 'received', resolved_at: '2026-09-28T10:00:00.000Z' },
  ];
  const saved = await putState(context, p, env.revision);
  await browser.close();
  return { today, revision: saved.revision, tasks: p.tasks.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed().then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e); process.exit(1); });
}
