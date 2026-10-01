import React from 'react';
import { APP_BUILD_VERSION, RELEASE_NOTES, formatReleaseDate } from '../../app/releaseInfo.js';
import { PageHeader } from '../../components/HeroVignette.jsx';
import { LifeLocaleContext } from '../../context/LocaleContext.jsx';
import { changeGroups } from '../../domain/releaseNotes.js';
import './updates.css';

/* global React */
const { useContext: useCtxUpd, useState: useStateUpd } = React;

/* JENKIN update history (#/updates), opened from Settings → About.
   Renders the validated repository source (data/releaseNotes.json) newest
   first: the newest entry starts expanded, older ones are collapsed but show
   version, status and date in their header. Each header is a real button
   (aria-expanded / aria-controls); technical details sit behind a native
   <details>. No animation is awaited; the chevron turn is skipped under
   reduced motion. */
/* Disclosure state: only the newest entry starts open; each header toggles
   its own entry and never closes another. */
function initialOpenIds(entries) {
  return new Set(entries.length ? [entries[0].id] : []);
}

function toggleOpenId(openIds, id) {
  const next = new Set(openIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function UpdatesPage({ notes = RELEASE_NOTES, buildVersion = APP_BUILD_VERSION }) {
  const { t, locale } = useCtxUpd(LifeLocaleContext);
  const entries = notes.ok ? notes.entries : [];
  const [openIds, setOpenIds] = useStateUpd(() => initialOpenIds(entries));
  const toggle = id => setOpenIds(prev => toggleOpenId(prev, id));

  let body;
  if (!notes.ok) body = <p className="upd-state is-error" role="alert">{t('upd_error')}</p>;
  else if (entries.length === 0) body = <p className="upd-state">{t('upd_empty')}</p>;
  else {
    body = (
      <ol className="upd-list" aria-label={t('upd_list_label')}>
        {entries.map(entry => (
          <ReleaseEntry key={entry.id}
                        entry={entry}
                        open={openIds.has(entry.id)}
                        onToggle={() => toggle(entry.id)}
                        t={t}
                        locale={locale} />
        ))}
      </ol>
    );
  }

  return (
    <div className="page upd-page">
      <PageHeader title={t('upd_title')} subtitle={t('upd_build', buildVersion)} />
      <div className="upd-body">
        <p className="upd-intro">{t('upd_intro')}</p>
        {body}
        <a className="upd-back" href="#/settings/about">{t('upd_back')}</a>
      </div>
    </div>
  );
}

function ReleaseEntry({ entry, open, onToggle, t, locale }) {
  const released = entry.status === 'released';
  const text = value => value[locale] || value.ru;
  const toggleId = `upd-${entry.id}-toggle`;
  const bodyId = `upd-${entry.id}-body`;
  const hasTechnical = Boolean(entry.technical || entry.refs);
  return (
    <li className={'panel upd-entry is-' + entry.status + (open ? ' is-open' : '')}>
      <h3 className="upd-entry-h">
        <button type="button"
                id={toggleId}
                className="upd-toggle"
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={onToggle}>
          <span className="upd-meta">
            <span className="upd-version mono">{released ? t('upd_version', entry.version) : t('upd_dev_build')}</span>
            <span className={'upd-status is-' + entry.status}>{t('upd_status_' + entry.status)}</span>
            {released
              ? <time className="upd-date" dateTime={entry.releasedOn}>{formatReleaseDate(entry.releasedOn, t('_intl_locale'))}</time>
              : <span className="upd-date">{t('upd_no_date')}</span>}
          </span>
          <span className="upd-entry-title">{text(entry.title)}</span>
          <svg className="upd-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
               fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      </h3>
      <div id={bodyId} className="upd-entry-body" role="region" aria-labelledby={toggleId} hidden={!open}>
        <p className="upd-summary">{text(entry.summary)}</p>
        {changeGroups(entry).map(group => (
          <section key={group.kind} className={'upd-group is-' + group.kind} aria-labelledby={`upd-${entry.id}-${group.kind}`}>
            <h4 id={`upd-${entry.id}-${group.kind}`} className="upd-group-h">{t('upd_kind_' + group.kind)}</h4>
            <ul className="upd-items">
              {group.items.map((item, i) => <li key={i}>{text(item)}</li>)}
            </ul>
          </section>
        ))}
        {hasTechnical && (
          <details className="upd-tech">
            <summary>{t('upd_technical')}</summary>
            {entry.technical && (
              <ul className="upd-items is-technical">
                {entry.technical.map((item, i) => <li key={i}>{text(item)}</li>)}
              </ul>
            )}
            {entry.refs && (
              <p className="upd-refs">
                <span className="upd-refs-label">{t('upd_refs')}</span>
                {entry.refs.map(ref => <code key={ref.value}>{ref.value}</code>)}
              </p>
            )}
          </details>
        )}
      </div>
    </li>
  );
}

export default UpdatesPage;
export { UpdatesPage, initialOpenIds, toggleOpenId };
