# LifeOS Calendar — Owner Decisions

Companion to `lifeos-calendar-current-code-discovery.md` (2026-09-29, main `414df14`).
Only OD-1 blocks the Plan. OD-2 to OD-4 already have defaults, so a reply is only needed if you disagree.

---

## OD-1 — What History closure states mean · OWNER_DECISION_REQUIRED=YES

**What your text says:**
> «все задачи сделанные, просроченные (обязательно отмеченные мной как незакрытые/закрытые/в архив) отправляются в отдельный таб с историей … статус закрытия, возможность восстановить задачу»

This is explicit on three points:
- completed tasks go to History;
- overdue tasks go to History **only after you mark them**;
- History shows a closure status and a Restore button.

It does not define the three marks. «незакрытые» ("not closed") as a *closure* state is ambiguous.

**What the code has today:**
- The only task state is `done: true/false`.
- Nothing records "closed without completion" or "archived".
- Delete is permanent.
- "Overdue" isn't a real state either: the current filter just checks whether the task has a time.

**Recommended default.** Actions on an overdue task in the day view:

| Action | Persisted as | In History |
|---|---|---|
| «выполнено» (done late) | `done: true` + `completed_at` | «выполнена» |
| «закрыть без выполнения» | `closure: 'closed_unresolved'` + `closed_at` | «закрыта, не выполнена» |
| «в архив» | `closure: 'archived'` + `closed_at` | «в архиве» |

Behaviour under this default:
- **No mark:** an overdue task stays in its day with an overdue marker and does not enter History automatically.
- **Restore:** returns the same task to active. Its date is unchanged, so it may show as overdue again.
- **Archive on non-overdue tasks:** the action is available on any task, not just overdue ones.
- **Delete:** stays permanent and never appears in History.

**Consequence:** this adds two optional fields to tasks (`closure`, `closed_at`) with no version bump. If you mean something different by «незакрытые» — for example, "leave it open but hide it" — the field values and the Restore behaviour change.

**Please confirm, or rename/redefine, the three marks.**

---

## OD-2 — Month grid layout · OWNER_DECISION_REQUIRED=NO (default adopted)

**What your text settles:** as many cubes as days, with the number and weekday on each cube, and nothing else. That also rules out cubes from the neighbouring months.

**What is still open:** whether the cubes line up under weekday columns (Mon…Sun) with blank gaps before the 1st.

**Default:** cubes flow freely and wrap to the screen width (4 per row on a phone, 7–8 on desktop). There are no blank spacers. The weekday printed on each cube is what tells you the day.

**Consequence:** this works on every width without horizontal scrolling. Weekday-aligned columns would make the weekday label on each cube redundant.

---

## OD-3 — Fake demo events and dog feedings · OWNER_DECISION_REQUIRED=NO (default adopted)

**What the code does today:** the Calendar shows 27 hard-coded demo events (standup, therapy, «ужин с Аней»…) in *every* week you browse, plus dog feedings repeated daily.

**Default:** remove both from the Calendar. The day view manages real tasks only. Dog feeding times stay on the Dog page.

**Consequence:** the Calendar looks empty until tasks have dates. That is truthful: missing data is not zero.

---

## OD-4 — Earliest year you can navigate to · OWNER_DECISION_REQUIRED=NO (default adopted)

**What your text settles:** 30 years visible at once, and a maximum of 2100. From 2026 that gives three pages: 2026–2055, 2056–2085 and 2086–2100.

**What is still open:** the lower bound.

**Default:** the earlier of this year and the earliest year that has a dated task.

**Consequence:** you can always get to past overdue days, and there are no empty historical pages.
