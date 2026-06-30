/* global React */
const { useEffect: useEffectDDM, useContext: useCtxDDM, useRef: useRefDDM } = React;

/* Sprint 3B · DayDetailModal
   Opens when the user clicks "+ N ещё" overflow on a day cell. Renders
   the full event list for that day with slightly larger pills (22px,
   text-md title). Esc closes. Footer button funnels to QuickAdd
   pre-filled with the date. */
function DayDetailModal({ date, events, onClose, onAddEvent, onOpenEvent }) {
  const { t, locale } = useCtxDDM(window.LifeLocaleContext);
  const I = window.LIcons;
  const closeRef = useRefDDM(null);

  useEffectDDM(() => {
    function onKey(e) { if (e.key === 'Escape') onClose && onClose(); }
    window.addEventListener('keydown', onKey);
    if (closeRef.current) closeRef.current.focus();
    /* Prevent body scroll while the modal is up. */
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  if (!date) return null;
  const intlLoc = window.LifeStrings[locale]._intl_locale;
  const fullDate = date.toLocaleDateString(intlLoc, {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="qa-backdrop" onMouseDown={onClose}>
      <div className="qa-modal modal-day" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="modal-day-head">
          <div className="modal-day-title">
            <div className="modal-day-eyebrow mono">{date.toLocaleDateString(intlLoc, { year: 'numeric' })}</div>
            <h3 className="modal-day-h">{fullDate}</h3>
          </div>
          <button className="qa-close" onClick={onClose} ref={closeRef} aria-label="close">
            {I.x ? <I.x size={16} /> : '×'}
          </button>
        </header>

        <div className="modal-day-body">
          {events.length === 0 ? (
            <div className="empty-state">{t('cal_quiet_day')}</div>
          ) : (
            <ul className="modal-day-list">
              {events.map(ev => {
                const kindClass = ev.kind === 'stakes' ? ' is-stakes'
                                : ev.kind === 'routine' ? ' is-routine'
                                : ' is-info';
                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      className={"cal-pill cal-pill-lg" + kindClass}
                      onClick={() => onOpenEvent && onOpenEvent(ev)}>
                      <span className="cal-pill-bar" aria-hidden="true"></span>
                      <span className="cal-pill-time mono">{ev.time}</span>
                      <span className="cal-pill-title">{ev.title}</span>
                      <span className="cal-pill-src mono">{(ev.source || '')}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="modal-day-foot">
          <button className="modal-day-add" onClick={onAddEvent}>
            + {t('cal_add_event')}
          </button>
        </footer>
      </div>
    </div>
  );
}

window.DayDetailModal = DayDetailModal;
