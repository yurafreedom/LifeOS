import React from 'react';
import { LifeLocaleContext } from '../../context/LocaleContext.jsx';
import { EditableField } from '../EditableField.jsx';

/* global React */
const { useContext: useCtxMC } = React;

function MeasurementsCard({ data, onChange }) {
  const { t } = useCtxMC(LifeLocaleContext);
  const Field = EditableField;

  const rows = [
    { key: 'chest',     label: t('pc_meas_chest') },
    { key: 'waist',     label: t('pc_meas_waist') },
    { key: 'hips',      label: t('pc_meas_hips') },
    { key: 'neck',      label: t('pc_meas_neck') },
    { key: 'shoulders', label: t('pc_meas_shoulders') },
    { key: 'sleeve',    label: t('pc_meas_sleeve') },
    { key: 'inseam',    label: t('pc_meas_inseam') },
    { key: 'shoe',      label: t('pc_meas_shoe') },
  ];

  return (
    <section className="pc-card">
      <header className="pc-head">
        <h3 className="pc-title">{t('pc_meas')}</h3>
        <span className="pc-sub mono">{t('pc_meas_sub')}</span>
      </header>
      <div className="pc-body pc-grid-2">
        {rows.map(r => (
          <div className="pc-row" key={r.key}>
            <div className="pc-label mono">{r.label}</div>
            <Field value={data[r.key]}
                   type="number"
                   mono
                   suffix={t('pc_body_unit_cm')}
                   onChange={(v) => onChange({ [r.key]: v })} />
          </div>
        ))}
        <div className="pc-row pc-row-wide">
          <div className="pc-label mono">{t('pc_body_notes')}</div>
          <Field value={data.notes}
                 placeholder={t('pc_meas_notes_ph')}
                 multiline
                 onChange={(v) => onChange({ notes: v })} />
        </div>
      </div>
    </section>
  );
}

export { MeasurementsCard };
