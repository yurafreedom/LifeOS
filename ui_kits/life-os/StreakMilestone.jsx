/* global React */
const { useContext: useCtxSM } = React;

function StreakMilestone({ milestone, onDismiss }) {
  const { t } = useCtxSM(window.LifeLocaleContext);
  const I = window.LIcons;
  if (!milestone) return null;
  const { days, habit } = milestone;
  return (
    <div className="milestone" role="status">
      <div className="milestone-icon" aria-hidden="true">{I.star({ size: 22 })}</div>
      <div className="milestone-body">
        <div className="mono milestone-eyebrow">{t('milestone_eyebrow', days, t.pl('pl_day', days))}</div>
        <div className="milestone-line">{t('milestone_line', days, t.pl('pl_day', days))}</div>
        <div className="mono milestone-sub">{habit}</div>
      </div>
      <button className="milestone-dismiss mono" onClick={onDismiss}>{t('milestone_dismiss')}</button>
    </div>
  );
}

window.StreakMilestone = StreakMilestone;
