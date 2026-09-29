# LifeOS Calendar — Recovered Source of Truth

## Recovery metadata

- Source export: `conversations.json`
- Source export SHA-256: `1691e35dd44f126dbcd41cce9cc387c8ec38aaeb0d6e75bca101c33827c400fc`
- Conversation: `LifeOS Dev chat`
- Conversation UUID: `3cfa1a74-079e-44e1-ae3c-bdec673f3b08`
- Source user message UUID: `019f1e07-d657-7b54-b00c-a32178200431`
- Source timestamp: `2026-07-01T14:14:19.721219Z`
- Source fragment carrying the detailed Calendar brief: `attachment:0`
- Companion Claude refinement in the same message: `attachment:2`
- Later implementation-plan summary in the same conversation: message `019f1e2b-6c28-712f-8112-4cca32648cfb`, `attachment:0`

This document separates **explicit owner requirements** from later Claude proposals and old implementation-plan assumptions.

---

# 1. OWNER-EXPLICIT CALENDAR REQUIREMENTS

The following is the recovered user-authored source text from `attachment:0`.

> Кидаю тебе архив проекта, можешь глянуть файлы какие тебе нужны чтобы понять текущий дизайн кнопок и подогнать варианты высоты/ширины/стилей под кнопки в разных местах дизайна. Не знаю хватит ли у тебя памяти чата чтобы проанализировать/распаковать все скриншоты экрана интерфейса из Архив zip без подписи, 
> Там есть пулл правок, часть ты можешь заметить сам детали, где что поехало, съехало, в иконках, в том что вылазит за экран, в том что кнопки в некоторых местах больше по высоте чем соседняя кнопка, и общая притензия ко всей реализации дизайна, раз уж это финальная версия которую не нужно адаптировать под другой код, везде секции/задачи/табы для выбора, слишком сука широкие по горизонтали, данные в 2 колонки где пару строчек растянуты блять на полэкрана или на всю ширину, так же само с задачами по финансам, общие задачи и так далее, нужно везде сделать аккуратно чтобы ширина была достаточная фиксированная или max-width относительно ширины контента а не доступного окна
> размер шрифта в разделе созданных задач у самой подписи задачи по сравнению с другими размерами мелкими шрифтов напротив рядом на всей странице просто убивает, неужели нельзя было подогнать все под один размер, я поднимал что задачи это важный акцент, но это смотрится уродски когда одни элементы больше других без обоснований
> и еще одна идея/рефакторинг, не баг, текущий календарь я бы сделал по-круче, в общем суть такая задумки:
> сколько дней в месяце, столько и кубиков вместо этих коротких табов с мелкими подписями списком задач на день, и кнопкой еще, когда я открыл всплывающее окно по конкретному дню, я понял что лучше изолировать каждый день отдельно матрешкой, я захожу в календарь а там 30-31 кубик цвета обычного состояния, при наведении кубик подсвечивается каким-то градиентным цветом по бокам тонко, с анимацией поднятия, или возможно есть примеры как было бы еще интереснее анимировать такой кубик, на кубике число и день недели, все, больше ничего не нужно, никаких задач, нажимая на кубик открывается тоже самое всплывающее меню которое открывается уже сейчас, но сейчас оно не гибкое, нужно сделать возможность изменить статус на завершенное/готовое с зеленой галочкой-кнопкой как мы продумали с тобой по дизайну игры острова, можно было удалить задачу из списка, можно было поменять местами между собой задачи в списке, изменить кстати еще поменять категорию задачи и статус: там их 2 было: "важно" и "рутина", можно было изменить параметры задачи которые я задавал в начале: дату/время/день/описание/название задачи = отдельным всплывающим попапом внутри попапа с возможностью сохранить конечно же, и если меняется буквально день/месяц (дата) задачи то она автоматически переноситься внутри календаря в другой кубик, все по классике, только свою удобную версию просмотра задач в календаре и их управлением, все задачи сделанные, просроченные (обязательно отмеченные мной как незакрытые/закрытые/в архив) отправляются в отдельный таб с историей, таблицей, дата создания задачи, название задачи, статус закрытия, возможность восстановить задачу. И еще ж, на уровне кубиков-дней можно вернуться на уровень кубиков-месяцев года текущего, на уровне месяцев года - можно переключиться табом на уровень кубиков лет: 2026 / 2027 / 2028 / 2029 / 2030 / 2031 / 2032 / 2033 / 2034 / 2035, сначала думал сказать про 9 лет, но лучше наверное 30 лет сразу наперед, если тебе важно знать сколько вообще лет в общем планировать по календарю, хотя вроде ж это по умолчанию может абсолютно на любой год перепрыгнуть вперед? хоть на 100 лет? или это нужно закладывать самому в функционале? если нужно - то максимум 2100, дальше не имеет смысла)

## Canonical owner requirements extracted from that text

### Calendar hierarchy

- The normal Calendar screen should not be the old short week/tab presentation.
- At the day level, render one cube for every day in the selected month: 28–31 cubes.
- A day cube contains only:
  - day number;
  - weekday.
- Do not show task pills/list content directly inside the cube.
- Clicking a day cube opens the day-specific task-management modal.
- The hierarchy must support zoom/navigation:
  - days of a month;
  - months of a year;
  - years.
- Planning horizon should support years through **2100**.

### Day cube interaction

The owner explicitly wanted:
- subtle gradient edge highlight on hover;
- a small lift animation;
- openness to a better animation if a stronger interaction pattern exists.

The exact visual implementation is therefore **directionally specified, not pixel-frozen**.

### Day modal / task management

Inside the selected-day modal, the owner explicitly requested:
- mark task completed using the established green-check affordance;
- delete a task;
- reorder tasks within the day;
- change task category / importance state:
  - important;
  - routine;
- edit task parameters:
  - date;
  - time;
  - day/date;
  - description;
  - title;
- editing happens via a nested popup/modal with save;
- changing the task date automatically moves it to the destination day/month cube.

### History

A separate Calendar history tab must contain tasks that are:
- completed;
- overdue and explicitly left unresolved / closed according to their state;
- archived.

The owner explicitly asked for a table/list containing at least:
- task creation date;
- task title;
- closure/status information;
- Restore action.

Restoring must return the task to active operational state rather than merely create a visual duplicate.

### Scope framing

The desired product is a familiar calendar/task system, but with a custom, isolated, cube-based browsing model:
- clean overview at month level;
- drill into one day for management;
- higher-level month/year navigation;
- operational task editing and history.

---

# 2. CLAUDE REFINEMENT — SECONDARY, NOT OWNER TEXT

The following was Claude's refinement in `attachment:2`. It is useful engineering context but must not override the owner text above.

> Sprint 3.7 — каталог что чинить (основа для спеки)
> Что я уже вижу в коде:
> 
> Ввести токен читаемой ширины (напр. --readable: ~680-720px) и применить к спискам задач, табам, 2-колоночным данным, финансам. Короткие строки больше не растягиваются на 1200px.
> 2-колоночные сетки (1fr 1fr) — дать им max-width, чтобы колонки не были по 600px под пару строк.
> Гармонизировать шрифты на странице задач: task-title 13px оставить, но теги поднять с 9.5px до 11-12px (не ниже floor), meta выровнять. Убрать необоснованные перепады.
> Разнобой высот кнопок — свести соседние кнопки к одному --btn-h-*.
> Overflow / иконки / что съехало — точечно по скринам, когда дойдём (тогда и посмотрю Архив адресно).
> 
> Полную спеку 3.7 напишу когда скажешь — с конкретными селекторами и значениями.
> 
> Sprint 3.8 — Календарь: концепт принят, отвечаю на вопросы
> Идея отличная и архитектурно чистая. Кубики-дни → клик → гибкий модал. Ключевое:
> Уровни (зум):
> 
> Дни — кубики по числу дней месяца (28-31). На кубике: число + день недели. Hover: тонкая градиентная подсветка по краям + лёгкий подъём (варианты анимации подберу). Никаких задач на кубике.
> Месяцы — 12 кубиков-месяцев текущего года (возврат с уровня дней).
> Годы — кубики лет.
> 
> Твой вопрос про диапазон лет — отвечаю чётко:
> Навигация стрелками (пред/след месяц/год) умеет прыгать на любую дату, хоть на 2200 — JS Date не имеет предела, это не надо «закладывать». НО сетку кубиков-лет нельзя рендерить бесконечной — ей нужен ограниченный диапазон. Рекомендую: год сетки от текущего до 2100 (показывать ближайшие ~12-30, листать дальше до 2100). Дальше 2100 смысла нет, ты прав.
> Про автоперенос задачи при смене даты — это получается само, если задачи хранить с полной ISO-датой, а кубик дня показывает задачи фильтром task.date === деньКубика. Поменял дату в задаче → она исчезает из старого кубика и появляется в новом автоматически. Никакого «хранения по годам» не нужно — всё привязано к дате.
> Гибкий day-модал (то что сейчас не гибко):
> 
> Статус → завершено (зелёная галочка-кнопка из Paradise).
> Удалить задачу из списка.
> Менять задачи местами (reorder).
> Менять категорию/статус: важно ↔ рутина.
> Редактировать параметры (дата/время/описание/название) — попап внутри попапа с сохранением. Смена даты → автоперенос в другой кубик.
> 
> История (отдельный таб): сделанные / просрочённые / архив → таблица: дата создания, название, статус закрытия, кнопка восстановить.
> Это самая большая из трёх работ — отдельный спринт с моделью данных, состоянием, ~5-6 новыми компонентами. Полную спеку напишу отдельно.

Key Claude proposals that are **not automatically owner-frozen**:
- `--readable` 680–720px belongs to the broader density pass, not Calendar semantics.
- Day-cube hover uses gradient edges + lift.
- Year grid is bounded/paged through 2100.
- Automatic task movement should be achieved by storing a complete date and deriving cube membership from that date.
- History is a separate tab.
- Claude estimated this as a large standalone sprint.

---

# 3. OLD DISCOVERY / PLAN CONTEXT

The old LifeOS refinement plan later placed Calendar as **Batch 3**, after:
1. layout/density;
2. schema migration.

Recovered plan summary:

> Plan saved to Outputs/Plans/lifeos-refinement_plan_2026-07-01.md. Summary below.
> 
> Implementation Plan — 6 batches
> 
> Order: Density → Schema migration → Calendar → GTD P0 → P1 → P2. Each independently shippable, QA'd in 4 theme/scene combos × RU/UA, one at a time with diffs + your confirm between batches. Only two sanctioned-new components across the whole scope: the calendar cube and the Clarify panel.
> 
> Forward-compat locked up front: one shared status enum (next/waiting/someday, orthogonal to stakes); Batch 3's day-modal status control is a generic segmented control driven by that enum, so Batch 4 adds GTD statuses with zero rework.
> 
> ┌──────────┬─────────────────────────────────────────────────────────────────────────────────────────┬─────┐
> │  Batch   │                                          Scope                                          │ Cx  │
> ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼─────┤
> │ 1        │ --readable (~680px) on task list/chips + finance tx + 2-col data blocks (exclude        │     │
> │ Density  │ .panel-grid+.home-charts); 12px floor (curated); harmonize button heights; paradise-day │ M   │
> │          │  card 0.86→0.96 + heading scrims; ?debug gate on .demo-rail                             │     │
> ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼─────┤
> │ 2 Schema │ one idempotent migrate() adding date/time/order/status/waitingFor/contexts + backfill;  │ M   │
> │          │ due kept; no UI                                                                         │     │
> ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼─────┤
> │ 3        │ cube DAYS⇄MONTHS⇄YEARS (years bounded, page to 2100); flexible day-modal                │     │
> │ Calendar │ (done/delete/reorder/status/edit); nested edit-popup (new z-stack infra); auto-move via │ L   │
> │          │  task.date; History tab + Restore                                                       │     │
> ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼─────┤
> │          │ Next/Waiting(+from-whom/since)/Someday + 3 filter capsules; 6-outcome Clarify panel     │     │
> │ 4 GTD P0 │ (project→new 0% Goal; reference→note archived, kept & retrievable, left out of active   │ L   │
> │          │ count; delete→gone); Weekly Review home accordion                                       │     │
> ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼─────┤
> │ 5 GTD P1 │ @-contexts (contexts[], distinct icon/color); Someday list; per-goal next-action +      │ M   │
> │          │ stuck flag; Focus Now widget                                                            │     │
> ├──────────┼─────────────────────────────────────────────────────────────────────────────────────────┼─────┤
> │ 6 GTD P2 │ horizon labels; Inbox Zero counter; auto-detectors                                      │ M   │
> └──────────┴─────────────────────────────────────────────────────────────────────────────────────────┴─────┘
> 
> Debug strip (Q4): it's .demo-rail in App.jsx:385-409 (tg test / sys test / cycle milestone / ⌘K / empty states / settings + RU-UA + D-L-P-S). Gated behind ?debug (survives hash routing), nothing deleted, toggles stay in Settings, no profile menu built.
> 
> 4 sign-off items + 1 veto request before I code Batch 1
> 
> 1. Button reversal: harmonizing .set-btn-danger 36→30 reverses ARCHITECTURE.md:118's deliberate call — OK to proceed?
> 2. 11px mono chrome: recommend keeping pure-mono 11px eyebrows/timestamps at 11, raising everything else to 12 — or do you want strict 12 everywhere?
> 3. paradise-night card 0.72→~0.90 for parity (prompt only specified day) — confirm?
> 4. Q3 leave-list veto: the full RAISE/LEAVE classification is in the plan file (§1b) — tell me any "leave" you want raised.
> 
> WAITING FOR: plan approval (+ the 4 acks / veto) before I write Batch 1 feature code.
> 
> ✻ Cogitated for 3m 30s

Relevant planned Calendar scope was:

- cube `DAYS ⇄ MONTHS ⇄ YEARS`;
- years bounded/paged to 2100;
- flexible day modal;
- done/delete/reorder/status/edit;
- nested edit popup;
- automatic move through task date;
- History + Restore.

The old plan also intentionally separated schema work before the Calendar UI.

---

# 4. WHAT ACTUALLY GOT IMPLEMENTED IN THAT OLD CONVERSATION

In the recovered `LifeOS Dev chat`:

- there is a concrete **Batch 1 complete** implementation report for layout/density;
- there is no matching human-pasted `Batch 2 complete`;
- there is no matching human-pasted `Batch 3 complete`;
- there is no Calendar completion report in that conversation.

Therefore the archive supports:

**Calendar was planned, but the recovered conversation does not show its intended cube redesign being completed.**

This does not by itself prove no later conversation ever implemented it; current repository state must be checked separately.

---

# 5. CURRENT MAIN GAP CHECK — 2026-09-29 BASELINE

Current verified GitHub main at the time of recovery:

`414df142700653d616016ff644bff3d9c0007540`

The current production Calendar still contains the older weekly pill model:

- `apps/web/src/components/CalendarView.jsx`
  - comments identify it as a thin-pill 7-day/week layout;
  - renders exactly 7 day columns;
  - shows event pills directly inside each day;
  - navigation moves by week;
  - only a week view button is present.

- `apps/web/src/pages/calendar/DayDetailModal.jsx`
  - opens primarily from the `+ N more` overflow;
  - displays events;
  - provides add-event;
  - does not implement the recovered full day-management contract.

- `apps/web/src/lib/calendar.js`
  - still aggregates a displayed week;
  - task placement is based on legacy `due` parsing (`eod`, `tomorrow`, `HH:MM`, weekday code);
  - it explicitly does not use the recovered full date-driven month cube model.

- `TaskDetailModal.jsx`
  - supports some task editing/completion/deletion;
  - but is not the recovered Calendar day-modal workflow and does not itself establish day-cube/month/year/history behavior.

So the user's remembered Calendar redesign is **still materially unimplemented on current main**.

---

# 6. SOURCE-OF-TRUTH CLASSIFICATION

## OWNER-EXPLICIT / CANONICAL

- 28–31 day cubes for selected month.
- Day cube shows only number + weekday.
- No task content on cube.
- Click cube → day task-management modal.
- Day modal supports complete, delete, reorder, important/routine, edit.
- Edit includes date/time/description/title.
- Date change moves task to another calendar day automatically.
- Separate History.
- History includes creation date, title, closure/status and Restore.
- Hierarchy day → month → year.
- Year planning horizon up to 2100.
- Cube hover should feel alive via subtle highlight/lift; exact animation may be refined.

## CLAUDE-PROPOSED / REQUIRES CURRENT-DESIGN RECONCILIATION

- Exact gradient/animation implementation.
- Exact number of year cubes visible per page.
- Exact internal task date representation.
- Exact modal nesting/z-index implementation.
- Exact History state vocabulary.
- Exact data migration strategy.
- Exact responsive grid breakpoints.

## OLD IMPLEMENTATION ASSUMPTIONS — DO NOT COPY BLINDLY

- old no-build/Babel architecture;
- old localStorage-only schema;
- old component/file names;
- old GTD status enum assumptions;
- old “only two sanctioned new components” restriction;
- old QA matrix wording.

Current LifeOS architecture is materially newer and must be used instead.

---

# 7. REQUIRED NEXT ENGINEERING PROCESS

Calendar should now be treated as its own production feature track:

1. **Current-code Calendar Discovery**
   - inspect current task schema/mutations;
   - inspect current CalendarView, DayDetailModal, TaskDetailModal;
   - inspect snapshot migration/current state version;
   - inspect history/archive semantics actually available;
   - inspect responsive/current theme system;
   - inspect localization;
   - inventory test coverage.

2. **Gap analysis**
   - owner source-of-truth vs current main.

3. **Implementation-grade Plan**
   - settle only genuinely unresolved product decisions;
   - do not resurrect stale old architecture.

4. **Implementation**
   - data semantics first where needed;
   - cube hierarchy;
   - day management;
   - history/restore;
   - responsive/a11y;
   - full regression.

5. **PR / validation / merge**

The recovered archive is product authority for the Calendar behavior, while current main is technical authority for implementation.
