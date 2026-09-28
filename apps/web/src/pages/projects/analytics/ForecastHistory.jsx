import React from 'react';
import AAProvenance from '../../../components/analytics/AAProvenance.jsx';
import { formatDateOnly, formatInstantDate } from '../../../analytics/projectAnalytics';

/*
 * Forecast version history (server-acknowledged, recorded order) and, apart
 * from it, the Actual with its correction lineage. The Actual is never listed
 * as a version; a forecast is labelled as the user's own, never «выведено».
 */

function When({ instant, locale }) {
  return <time className="aa-hist-when" dateTime={instant}>{formatInstantDate(instant, locale)}</time>;
}

function DateText({ value, locale }) {
  return <time dateTime={value}>{formatDateOnly(value, locale)}</time>;
}

function VersionRow({ fact, previous, isFirst, isLatest, t, locale, narrow }) {
  const date = fact.value?.date;
  return <li className="aa-hist-row" data-version-status={fact.status}>
    <When instant={fact.provenance.recorded_at} locale={locale} />
    <div className="aa-hist-what">
      <b>{isFirst ? t('aa_pj_version_first') : t('aa_pj_version_new')}</b>
      {' · '}
      {previous?.value?.date && !isFirst
        ? <><DateText value={previous.value.date} locale={locale} />{' → '}<DateText value={date} locale={locale} /></>
        : <DateText value={date} locale={locale} />}
      {' · '}{t('aa_pj_user_forecast')}
      {isLatest ? <> · {t('aa_pj_version_latest')}</> : null}
    </div>
    <AAProvenance provenance={fact.provenance} narrow={narrow} />
  </li>;
}

export function ForecastHistory({ data, t, locale, narrow }) {
  const versions = data.forecast_versions;
  const actual = data.actual;
  return <>
    <div className="aa-section-head">
      <h3 className="panel-title" id="pa-history">{t('aa_pj_history_title')}</h3>
      <span className="aa-quiet">{t('aa_pj_history_sub')}</span>
    </div>
    {versions.length === 0
      ? <p className="aa-none">{t('aa_pj_no_versions')}</p>
      : <ol className="aa-hist" aria-label={t('aa_pj_versions_group')}>
        {versions.map((fact, index) => <VersionRow key={fact.id} fact={fact} previous={versions[index - 1]}
          isFirst={index === 0} isLatest={index === versions.length - 1} t={t} locale={locale} narrow={narrow} />)}
      </ol>}
    {data.forecast_versions_truncated
      ? <p className="aa-note">{t('aa_pj_truncated', versions.length, data.forecast_version_count)}</p>
      : null}

    <div className="aa-section-head aa-pj-actual-head">
      <h3 className="panel-title" id="pa-actual">{t('aa_pj_actual_title')}</h3>
      <span className="aa-quiet">{t('aa_pj_actual_separate')}</span>
    </div>
    {actual
      ? <ol className="aa-hist" aria-labelledby="pa-actual">
        {data.actual_corrections.map(row => <li className="aa-hist-row" key={row.id} data-actual-status={row.status}>
          <When instant={row.provenance.recorded_at} locale={locale} />
          <div className="aa-hist-what">{t('aa_pj_actual_corrected_from')} <DateText value={row.value.date} locale={locale} /></div>
          <AAProvenance provenance={row.provenance} narrow={narrow} />
        </li>)}
        <li className="aa-hist-row" data-actual-status={actual.status}>
          <When instant={actual.provenance.recorded_at} locale={locale} />
          <div className="aa-hist-what">
            <b>{t('aa_pj_actual_done')}</b>{' · '}<DateText value={actual.value.date} locale={locale} />
            {' · '}{t(actual.provenance.source_kind === 'OBSERVED' ? 'aa_pj_observed_completion' : 'aa_pj_user_correction')}
          </div>
          <AAProvenance provenance={actual.provenance} narrow={narrow} />
        </li>
      </ol>
      : <p className="aa-none">{t('aa_pj_actual_absent_long')}</p>}
    {data.actual_count > 1 ? <p className="aa-note">{t('aa_pj_actual_many', data.actual_count)}</p> : null}
  </>;
}
