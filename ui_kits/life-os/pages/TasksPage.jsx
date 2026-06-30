/* global React */
const { useState: useStateTP, useMemo: useMemoTP, useContext: useCtxTP } = React;

/* Tasks tab — master view of every task across routine + stakes.
   Filter chips on the left, sort dropdown on the right. Reuses the same
   task-row markup as the home composite, opens TaskDetailModal on click. */
function TasksPage({ tasks, onToggle, onAdd, onOpen }) {
  const { t } = useCtxTP(window.LifeLocaleContext);
  const I = window.LIcons;
  const [filter, setFilter] = useStateTP('all');
  const [sort, setSort]     = useStateTP('date');
  const [sortOpen, setSortOpen] = useStateTP(false);

  const filters = [
    { id: 'all',     label: t('tasks_filter_all') },
    { id: 'today',   label: t('tasks_filter_today') },
    { id: 'overdue', label: t('tasks_filter_overdue') },
    { id: 'routine', label: t('tasks_filter_routine') },
    { id: 'stakes',  label: t('tasks_filter_stakes') },
    { id: 'done',    label: t('tasks_filter_done') },
  ];
  const sorts = [
    { id: 'date',     label: t('tasks_sort_date') },
    { id: 'priority', label: t('tasks_sort_priority') },
    { id: 'category', label: t('tasks_sort_category') },
  ];

  const filtered = useMemoTP(() => {
    let xs = tasks.slice();
    if (filter === 'today')   xs = xs.filter(x => x.tag === 'today' || x.stakes);
    if (filter === 'overdue') xs = xs.filter(x => !x.done && x.due && x.due.includes(':'));
    if (filter === 'routine') xs = xs.filter(x => !x.stakes && !x.done);
    if (filter === 'stakes')  xs = xs.filter(x => x.stakes && !x.done);
    if (filter === 'done')    xs = xs.filter(x => x.done);
    if (sort === 'priority')  xs.sort((a, b) => (b.stakes ? 1 : 0) - (a.stakes ? 1 : 0));
    if (sort === 'category')  xs.sort((a, b) => String(a.tag || '').localeCompare(String(b.tag || '')));
    return xs;
  }, [tasks, filter, sort]);

  const openCount = tasks.filter(x => !x.done).length;

  return (
    <div className="page tasks-page">
      <header className="page-head">
        <div className="page-head-left">
          <h2 className="page-title">{t('tasks_page_title')}</h2>
          <div className="page-sub mono">{t('tasks_page_meta', openCount, tasks.length)} · {t.pl('pl_task', openCount)}</div>
        </div>
      </header>

      <div className="tasks-toolbar">
        <div className="tasks-chips">
          {filters.map(f => (
            <button key={f.id}
                    className={"tasks-chip" + (filter === f.id ? " is-on" : "")}
                    onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="tasks-sort">
          <button className="tasks-sort-trigger mono"
                  onClick={() => setSortOpen(o => !o)}>
            <span>{t('tasks_sort_label')}: {sorts.find(s => s.id === sort).label}</span>
            <I.chevDown size={12}/>
          </button>
          {sortOpen && (
            <div className="tasks-sort-pop"
                 onMouseLeave={() => setSortOpen(false)}>
              {sorts.map(s => (
                <button key={s.id}
                        className={"tasks-sort-opt" + (sort === s.id ? " is-on" : "")}
                        onClick={() => { setSort(s.id); setSortOpen(false); }}>{s.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">{t('tasks_empty')}</div>
      ) : (
        <section className="card panel tasks-list-card">
          <div className="task-list">
            {filtered.map(task => (
              <div key={task.id} className={"task-row" + (task.stakes ? " is-stakes" : "")}>
                <button className={"task-check" + (task.done ? " is-done" : "")}
                        onClick={() => onToggle(task.id)}>
                  {task.done && I.check({ size: 12 })}
                </button>
                <button className={"task-title task-title-btn" + (task.done ? " is-done" : "")}
                        onClick={() => onOpen && onOpen(task)}>{task.title}</button>
                <div className="task-meta">
                  {(task.tag || task.tagLabel) && (
                    <span className={"task-tag" + (task.stakes ? " is-stakes" : "")}>
                      {task.tagLabel || t('tag_' + task.tag, task.tag)}
                    </span>
                  )}
                  {task.due && <span className="task-due mono">{task.due}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

window.TasksPage = TasksPage;
