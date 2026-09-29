import React from 'react';
import { useAAText } from './useAAText.js';
import '../../analytics.css';

/*
 * I · Experiment stages: гипотеза · базовый уровень · период · наблюдения ·
 * результат · решение. Driven by the lifecycle alone — a decision never marks a
 * stage done (D4: lifecycle ≠ outcome). An abandoned experiment keeps the
 * stages it actually reached; the rest are neither done nor current.
 */
export const EXPERIMENT_STAGES = ['hypothesis', 'baseline', 'run', 'observe', 'result', 'decision'];

/* Per lifecycle: how many stages are done, and which (1-based) are current. */
const PROGRESS = {
  DRAFT: { done: 0, now: [1] },
  RUNNING: { done: 2, now: [3] },
  COMPLETED_AWAITING_REVIEW: { done: 4, now: [5, 6] },
  REVIEWED: { done: 6, now: [] },
};
/* What an abandoned experiment had reached when it was stopped. */
const REACHED_BEFORE_STOP = { DRAFT: 1, RUNNING: 3, COMPLETED_AWAITING_REVIEW: 4 };

export function stageProgress(lifecycle, abandonedFrom) {
  if (lifecycle === 'ABANDONED') return { done: REACHED_BEFORE_STOP[abandonedFrom] ?? 0, now: [] };
  return PROGRESS[lifecycle] ?? PROGRESS.DRAFT;
}

export default function AAExpStages({ lifecycle, abandonedFrom = null }) {
  const t = useAAText();
  const { done, now } = stageProgress(lifecycle, abandonedFrom);
  const stopped = lifecycle === 'ABANDONED';
  return <div className="aa-exp-stages">
    <ol className="aa-exp-stage" aria-label={t('aa_ex_stages_group')}>
      {EXPERIMENT_STAGES.map((stage, index) => {
        const position = index + 1;
        const state = position <= done ? 'is-done' : now.includes(position) ? 'is-now' : '';
        return <li key={stage} className={`aa-exp-step${state ? ` ${state}` : ''}`}
          aria-current={state === 'is-now' ? 'step' : undefined}>
          {index > 0 ? <span className="aa-exp-arrow" aria-hidden="true">→</span> : null}
          <span className="aa-exp-step-label">{t(`aa_ex_stage_${stage}`)}</span>
          {state === 'is-done' ? <span className="aa-sr-only">{t('aa_ex_stage_done_sr')}</span> : null}
        </li>;
      })}
    </ol>
    {stopped
      ? <p className="aa-quiet aa-exp-stopped">{t(abandonedFrom === 'COMPLETED_AWAITING_REVIEW'
        ? 'aa_ex_stopped_after_period' : 'aa_ex_stopped_in_period')}</p>
      : null}
  </div>;
}
