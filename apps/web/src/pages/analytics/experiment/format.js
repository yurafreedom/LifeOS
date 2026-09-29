/* Experiment · shared copy and formatting helpers. No derived analytics here. */

import { formatDateOnly, formatInstantDate } from '../../../analytics/projectAnalytics';

export const CHOICE_KEYS = {
  keep: 'aa_ex_choice_keep',
  modify: 'aa_ex_choice_modify',
  longer: 'aa_ex_choice_longer',
  reject: 'aa_ex_choice_reject',
  inconclusive: 'aa_ex_choice_inconclusive',
};

export const lifecycleKey = lifecycle => `aa_ex_lifecycle_${String(lifecycle).toLowerCase()}`;

export function choiceLabel(choice, t) {
  return choice == null ? t('aa_ex_choice_none') : t(CHOICE_KEYS[choice] ?? choice);
}

export function windowText(start, end, t) {
  const locale = t('_intl_locale');
  return `${formatDateOnly(start, locale)} — ${formatDateOnly(end, locale)}`;
}

export const dateText = (value, t) => formatDateOnly(value, t('_intl_locale'));
export const instantText = (value, t) => formatInstantDate(value, t('_intl_locale'));

/** «14 дней» / «14 днів» through the locale's plural forms. */
export function daysText(count, t) {
  return `${count} ${t.pl ? t.pl('pl_day', count) : ''}`.trim();
}

/** The status line under the title, from the lifecycle only. */
export function statusText(detail, t) {
  if (detail.lifecycle === 'ABANDONED') {
    return t(detail.abandoned_from === 'COMPLETED_AWAITING_REVIEW'
      ? 'aa_ex_stopped_after_period' : 'aa_ex_stopped_in_period');
  }
  if (detail.lifecycle === 'RUNNING' && detail.window.completion_due) return t('aa_ex_status_period_over');
  return t(lifecycleKey(detail.lifecycle));
}

/** A plain-text semantic history (no HTML strings), newest first. */
export function historyRows(detail, t) {
  const rows = detail.lifecycle_events.map(event => ({
    key: `life-${event.state}`,
    when: event.occurred_at,
    what: t(`aa_ex_event_${event.state.toLowerCase()}`),
  }));
  for (const entry of detail.adherence.days) {
    if (entry.record?.corrected) {
      rows.push({
        key: `adh-${entry.day}`,
        when: entry.record.recorded_at,
        what: t('aa_ex_event_adherence_corrected', dateText(entry.day, t), t(`aa_ex_adh_${entry.state}`)),
      });
    }
  }
  for (const condition of detail.conditions) {
    rows.push({
      key: `cond-${condition.id}`,
      when: condition.occurred_at,
      what: t('aa_ex_event_condition', condition.value?.text ?? ''),
    });
  }
  /* Every save is kept on the server; a save that left the choice as it was is
     not a change, so consecutive equal choices collapse here. */
  let previous;
  detail.decision.history.forEach((revision, index) => {
    if (index > 0 && revision.choice === previous) return;
    previous = revision.choice;
    rows.push({
      key: `dec-${revision.revision}`,
      when: revision.created_at,
      what: t(index === 0 ? 'aa_ex_event_decision' : 'aa_ex_event_decision_changed',
        choiceLabel(revision.choice, t)),
    });
  });
  return rows.sort((a, b) => Date.parse(b.when) - Date.parse(a.when));
}

/** Tab / Shift+Tab inside a dialog: wraps around, never leaves it. */
export function focusStep(index, count, backwards) {
  if (count <= 0) return -1;
  if (backwards) return index <= 0 ? count - 1 : index - 1;
  return (index + 1) % count;
}
