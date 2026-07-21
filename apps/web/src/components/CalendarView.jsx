import React from 'react';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext, LifeStrings } from '../context/LocaleContext.jsx';
import { LifeCalendar } from '../lib/calendar.js';
import { DayDetailModal } from '../pages/calendar/DayDetailModal.jsx';

/* global React */
const { useState: useStateCal, useContext: useCtxCal, useMemo: useMemoCal, useCallback: useCbCal } = React;

/* Sprint 3B · CalendarView redesign.
   Replaces the v1 hour-grid with a thin-pill day-cell layout:
     · 7 day columns (Mon-first), each tall enough for up to 8 pills.
     · Pill = 3px colored left bar + HH:MM mono + truncated title (18px tall).
     · 9th+ event → "+ N ещё" overflow row → opens DayDetailModal.
     · Today column gets the locked --blue tint (NOT stakes orange).
     · Density (N=8) hardcoded for 3B; Settings slider says "Sprint 4".
   Events come from lib/calendar.js aggregator. */

const CAL_MAX_PILLS = 8;
const CAL_VISIBLE_BEFORE_OVERFLOW = 7;  // 8th slot used by "+N ещё"

function CalendarView({ onAddSlot, onOpenTask }) {
  const { t, locale } = useCtxCal(LifeLocaleContext);
  const data = useCtxCal(LifeDataContext);
  const intlLoc = LifeStrings[locale]._intl_locale;

  const [anchor, setAnchor] = useStateCal(new Date());
  const [dayModal, setDayModal] = useStateCal(null);  // Date | null

  /* Mon-first week of `anchor`. */
  const weekStart = useMemoCal(() => {
    const d = new Date(anchor);
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [anchor]);

  const days = useMemoCal(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  }), [weekStart]);

  const { days: buckets, todayIdx } = useMemoCal(
    () => LifeCalendar.aggregate(weekStart, data.state, t),
    [weekStart, data.state, t]
  );

  const monthLabel = days[3].toLocaleDateString(intlLoc, { month: 'long', year: 'numeric' });

  function moveWeek(delta) {
    const d = new Date(anchor); d.setDate(d.getDate() + delta * 7); setAnchor(d);
  }
  function jumpToday() { setAnchor(new Date()); }

  function openDay(d) { setDayModal(d); }
  function closeDay() { setDayModal(null); }

  /* Click routing for pills + day-modal rows. */
  const handlePill = useCbCal((ev) => {
    if (!ev) return;
    if (ev.entity && ev.entity.type === 'task' && onOpenTask) {
      const task = (data.state.tasks || []).find(x => String(x.id) === String(ev.entity.id));
      if (task) onOpenTask(task);
      return;
    }
    /* All other entity types route through the day-detail modal for
       now — Sprint 4 wires per-source detail surfaces (bills →
       TransactionDetailModal, meds → MedDetailPage, etc). */
    // no-op for now
  }, [data.state.tasks, onOpenTask]);

  return (
    <div className="cal cal-pill-view">
      <div className="cal-head">
        <h2 className="cal-h">{monthLabel}</h2>
        <div className="cal-nav">
          <button className="cal-btn" onClick={() => moveWeek(-1)} aria-label={t('cal_prev')}>{t('cal_prev')}</button>
          <button className="cal-btn mono" onClick={jumpToday}>{t('cal_today')}</button>
          <button className="cal-btn" onClick={() => moveWeek(1)} aria-label={t('cal_next')}>{t('cal_next')}</button>
        </div>
        <div className="cal-views mono">
          <button className="cal-view-btn is-on">{t('cal_week')}</button>
        </div>
      </div>

      <div className="cal-pill-grid">
        {days.map((d, i) => {
          const events = buckets[i] || [];
          const isToday = i === todayIdx;
          const overflow = Math.max(0, events.length - CAL_VISIBLE_BEFORE_OVERFLOW);
          const shown    = overflow > 0 ? events.slice(0, CAL_VISIBLE_BEFORE_OVERFLOW) : events.slice(0, CAL_MAX_PILLS);

          return (
            <div key={i} className={"cal-day" + (isToday ? " is-today" : "")}>
              <div className="cal-day-head">
                <div className="cal-day-dow mono">
                  {d.toLocaleDateString(intlLoc, { weekday: 'short' }).replace('.', '')}
                </div>
                <div className={"cal-day-num" + (isToday ? " is-today" : "")}>{d.getDate()}</div>
              </div>

              <div className="cal-day-body" onClick={() => onAddSlot && onAddSlot(d)}>
                {events.length === 0 && (
                  <div className="cal-day-empty mono">{t('cal_quiet_day')}</div>
                )}
                {shown.map(ev => (
                  <CalPill key={ev.id} ev={ev} onClick={(e) => { e.stopPropagation(); handlePill(ev); }} />
                ))}
                {overflow > 0 && (
                  <button
                    className="cal-pill cal-pill-more mono"
                    onClick={(e) => { e.stopPropagation(); openDay(d); }}>
                    {t('cal_more_n', overflow)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {dayModal && (
        <DayDetailModal
          date={dayModal}
          events={buckets[days.findIndex(x =>
            x.getFullYear() === dayModal.getFullYear() &&
            x.getMonth() === dayModal.getMonth() &&
            x.getDate() === dayModal.getDate()
          )] || []}
          onClose={closeDay}
          onAddEvent={() => { closeDay(); onAddSlot && onAddSlot(dayModal); }}
          onOpenEvent={handlePill}
        />
      )}
    </div>
  );
}

/* Inner pill — kept inline so styles stay local. */
function CalPill({ ev, onClick }) {
  const kindClass = ev.kind === 'stakes' ? ' is-stakes'
                  : ev.kind === 'routine' ? ' is-routine'
                  : ' is-info';
  return (
    <button
      type="button"
      className={"cal-pill" + kindClass}
      onClick={onClick}
      title={ev.time + ' · ' + ev.title}>
      <span className="cal-pill-bar" aria-hidden="true"></span>
      <span className="cal-pill-time mono">{ev.time}</span>
      <span className="cal-pill-title">{ev.title}</span>
    </button>
  );
}

export { CalendarView };
