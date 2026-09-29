/* Experiment · list: server-acknowledged experiments grouped by lifecycle,
   plus creates still waiting in the local queue (read from the queue record,
   never invented). */

import React from 'react';
import { PENDING_LIFECYCLES, experimentHash, newExperimentHash } from '../../../analytics/experimentFacts';
import { useAAText } from '../../../components/analytics/useAAText.js';
import { lifecycleKey, windowText } from './format.js';

function Item({ item, t }) {
  return <li className="aa-exp-item">
    <a className="aa-exp-item-link" href={experimentHash(item.id)}>
      <span className="aa-exp-item-title">{item.title}</span>
      <span className="aa-exp-item-meta">
        <span className="aa-tag" data-lifecycle={item.lifecycle}>{t(lifecycleKey(item.lifecycle))}</span>
        <span className="aa-quiet">{windowText(item.window_start, item.window_end, t)}</span>
        {item.completion_due ? <span className="aa-quiet">{t('aa_ex_status_period_over')}</span> : null}
      </span>
    </a>
  </li>;
}

export function ExperimentListView({ data = null, error = null, queued = [], canCreate = true }) {
  const t = useAAText();
  const experiments = data?.experiments ?? [];
  const open = experiments.filter(item => PENDING_LIFECYCLES.includes(item.lifecycle));
  const closed = experiments.filter(item => !PENDING_LIFECYCLES.includes(item.lifecycle));
  const known = new Set(experiments.map(item => item.id));
  const unsaved = queued.filter(record => !known.has(record.payload?.id));

  return <div className="aa-exp-list">
    <div className="aa-actions">
      <span className="aa-quiet">{t('aa_ex_list_hint')}</span>
      {canCreate
        ? <a className="set-btn-primary aa-exp-new" href={newExperimentHash()}>{t('aa_ex_new')}</a>
        : <span className="aa-quiet">{t('aa_ex_no_uuid')}</span>}
    </div>
    {unsaved.length
      ? <section className="card panel aa-section" aria-labelledby="exp-unsaved">
        <h3 className="panel-title" id="exp-unsaved">{t('aa_ex_unsaved_title')}</h3>
        <ul className="aa-exp-items">{unsaved.map(record => <li className="aa-exp-item" key={record.queue_id}>
          <a className="aa-exp-item-link" href={experimentHash(record.payload.id)}>
            <span className="aa-exp-item-title">{record.payload.title}</span>
            <span className="aa-quiet">{t('aa_ex_not_saved_yet')}</span>
          </a>
        </li>)}</ul>
      </section>
      : null}
    {error
      ? <section className="card panel"><p className="aa-none" role="alert">{t('aa_ex_unavailable')}</p></section>
      : !data
        ? <section className="card panel" aria-busy="true"><p className="aa-note">{t('aa_ex_loading')}</p></section>
        : <>
          <section className="card panel aa-section" aria-labelledby="exp-open">
            <h3 className="panel-title" id="exp-open">{t('aa_ex_group_open')}</h3>
            {open.length
              ? <ul className="aa-exp-items">{open.map(item => <Item key={item.id} item={item} t={t} />)}</ul>
              : <p className="aa-none">{t('aa_ex_empty_open')}</p>}
          </section>
          {closed.length
            ? <section className="card panel aa-section" aria-labelledby="exp-closed">
              <h3 className="panel-title" id="exp-closed">{t('aa_ex_group_closed')}</h3>
              <ul className="aa-exp-items">{closed.map(item => <Item key={item.id} item={item} t={t} />)}</ul>
            </section>
            : null}
        </>}
  </div>;
}
