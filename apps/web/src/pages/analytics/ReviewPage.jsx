import React from 'react';
import { useAAText } from '../../components/analytics/useAAText.js';
import { AnalyticsContext } from '../../context/AnalyticsContext.jsx';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import { parseReviewHash, subjectFromKey } from '../../analytics/review';
import { ReviewFlow } from './review/Flow.jsx';
import { SavedReview } from './review/SavedReview.jsx';
import '../../analytics.css';

/*
 * E · Review / Debrief — semantic reflection, not a GTD weekly review.
 *
 * Five optional steps. Nothing is required, nothing is scored, nothing is
 * recommended, and no cause is inferred: factors carry the user's own epistemic
 * kind, and «Пока без решения» is a different answer from «Непонятно — данных
 * недостаточно». The evidence shown is exactly what the server froze; later
 * corrections are flagged beside it, and erased sources read «источник удалён».
 */

function useNarrow() {
  const query = '(max-width: 700px)';
  const [narrow, setNarrow] = React.useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return narrow;
}

function exitHash(subjectKey) {
  return subjectFromKey(subjectKey).domain === 'finance' ? '#/analytics' : '#/projects';
}

function readHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

export default function ReviewPage() {
  const t = useAAText();
  const analytics = React.useContext(AnalyticsContext);
  const projects = React.useContext(LifeDataContext)?.state?.projects;
  const narrow = useNarrow();
  const [route, setRoute] = React.useState(() => parseReviewHash(readHash()));
  const [data, setData] = React.useState({ loading: true, error: null, context: null, review: null, earlier: [] });
  const ready = analytics?.ready;

  React.useEffect(() => {
    const onHash = () => setRoute(parseReviewHash(readHash()));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const load = React.useCallback(async signal => {
    if (!route || !ready) return;
    setData(previous => ({ ...previous, loading: true, error: null }));
    try {
      if (route.mode === 'new') {
        const [context, earlier] = await Promise.all([
          analytics.readReviewContext({ subject: route.subject, from: route.from, to: route.to }, signal),
          analytics.listReviews(route.subject, signal).then(list => list.reviews).catch(() => []),
        ]);
        setData({ loading: false, error: null, context, review: null, earlier });
      } else {
        const review = await analytics.readReview(route.id, signal);
        setData({ loading: false, error: null, context: null, review, earlier: [] });
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setData({ loading: false, error, context: null, review: null, earlier: [] });
    }
  }, [route, ready]);

  React.useEffect(() => {
    const controller = new window.AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function revise(request) {
    await analytics.enqueueReview(request);
    await analytics.flush?.();
    await load();
  }

  const subjectKey = route?.mode === 'new' ? route.subject : data.review?.subject_key;
  let body;
  if (!route) body = <div className="aa-none">{t('aa_rv_bad_link')}</div>;
  else if (data.error) body = <div className="aa-none" role="alert">{t('aa_rv_unavailable', data.error.message)}</div>;
  else if (data.loading || !analytics) body = <div className="aa-quiet">{t('aa_rv_loading')}</div>;
  else if (route.mode === 'new') {
    body = <ReviewFlow context={data.context} projects={projects} narrow={narrow} earlier={data.earlier}
      onSave={request => analytics.enqueueReview(request)} />;
  } else {
    body = <SavedReview key={`${data.review.id}-${data.review.current_revision}`} review={data.review}
      projects={projects} narrow={narrow} onRevise={revise} />;
  }
  return <section className={`aa-review${narrow ? ' aa-narrow' : ''}`}>
    <div><a className="aa-link" href={subjectKey ? exitHash(subjectKey) : '#/home'}>{t('aa_rv_exit')}</a></div>
    {body}
  </section>;
}

/* Re-exported for callers and tests that import these views from the page. */
export { deltaProps, flagText } from './review/format.js';
export { ReviewEvidence } from './review/Evidence.jsx';
export { ReviewFlow } from './review/Flow.jsx';
export { SavedReview } from './review/SavedReview.jsx';
