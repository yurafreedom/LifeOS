/* global React */
/* components/ActivityTimeline.jsx
 *
 * Renders the chronological history of a single entity from the
 * global activityLog. Drops into TaskDetailModal, MedDetailPage,
 * and the per-med dose-history tab.
 *
 * Props:
 *   entityType  — 'task' | 'transaction' | 'med_dose' | 'med_config'
 *                 | 'mode_style' | 'note' | etc. Pass null to show
 *                 every entry (used by the global ИСТОРИЯ tab).
 *   entityId    — id of the row. Null = no filter on id.
 *   emptyKey    — i18n key for the empty state. Defaults to a
 *                 generic message.
 *   limit       — max rows to render (default 50).
 *   filter      — additional optional `entry => boolean` filter
 *                 (used by global ИСТОРИЯ tab to scope to a med).
 *
 * Visual: same mono row vocabulary as TaskDetailModal had inline
 * before. Newest first. */

const { useContext: useCtxAT } = React;

function ActivityTimeline({ entityType, entityId, emptyKey, limit, filter }) {
  const data = useCtxAT(window.LifeDataContext);
  const { locale, t } = useCtxAT(window.LifeLocaleContext);
  if (!data) return null;
  const log = data.state.activityLog || [];
  let rows = window.LifeActivity.entriesFor(log, entityType, entityId);
  if (filter) rows = rows.filter(filter);
  const cap = limit || 50;
  if (rows.length > cap) rows = rows.slice(0, cap);

  if (rows.length === 0) {
    return (
      <div className="atl atl-empty mono">
        {t(emptyKey || 'atl_empty')}
      </div>
    );
  }

  const intlLoc = (window.LifeStrings[locale] && window.LifeStrings[locale]._intl_locale) || 'ru-RU';
  return (
    <div className="atl">
      {rows.map(r => {
        const d = new Date(r.timestamp);
        const when = d.toLocaleDateString(intlLoc, { day: 'numeric', month: 'short' })
                   + ' · ' + d.toTimeString().slice(0, 5);
        return (
          <div key={r.id} className="atl-row mono">
            <span className="atl-when">{when}</span>
            <span className="atl-what">{describeAction(r, t, locale)}</span>
            {r.details && r.details.text ? (
              <span className="atl-detail">{r.details.text.slice(0, 80)}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function describeAction(entry, t, locale) {
  const a = entry.action;
  const lookup = window.LifeATLLabels && window.LifeATLLabels[locale === 'uk' ? 'uk' : 'ru'];
  if (lookup && lookup[a]) return lookup[a];
  return a.replace(/_/g, ' ');
}

/* Localized action labels. Lives here, not in i18n.jsx, to keep
   the action vocabulary co-located with the timeline component. */
window.LifeATLLabels = {
  ru: {
    created:           'создано',
    edited:            'отредактировано',
    completed:         'выполнено',
    reopened:          'возвращено в работу',
    deleted:           'удалено',
    restored:          'восстановлено',
    dose_taken:        'доза принята',
    dose_skipped:      'доза пропущена',
    dose_snoozed:      'отложено на час',
    mode_changed:      'стратегия изменена',
    inventory_updated: 'инвентарь обновлён',
    note_added:        'заметка добавлена',
    note_edited:       'заметка отредактирована',
    note_deleted:      'заметка удалена',
  },
  uk: {
    created:           'створено',
    edited:            'відредаговано',
    completed:         'виконано',
    reopened:          'повернуто в роботу',
    deleted:           'видалено',
    restored:          'відновлено',
    dose_taken:        'дозу прийнято',
    dose_skipped:      'дозу пропущено',
    dose_snoozed:      'відкладено на годину',
    mode_changed:      'стратегію змінено',
    inventory_updated: 'інвентар оновлено',
    note_added:        'нотатку додано',
    note_edited:       'нотатку відредаговано',
    note_deleted:      'нотатку видалено',
  },
};

window.ActivityTimeline = ActivityTimeline;
