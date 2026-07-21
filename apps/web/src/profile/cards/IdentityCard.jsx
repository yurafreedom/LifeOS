import React from 'react';
import { LifeLocaleContext } from '../../context/LocaleContext.jsx';
import { EditableField } from '../EditableField.jsx';

/* global React */
const { useContext: useCtxIC } = React;

function IdentityCard({ data, onChange }) {
  const { t } = useCtxIC(LifeLocaleContext);
  const Field = EditableField;
  return (
    <section className="pc-card">
      <header className="pc-head">
        <h3 className="pc-title">{t('pc_identity')}</h3>
      </header>
      <div className="pc-body pc-grid-2">
        <div className="pc-row">
          <div className="pc-label mono">{t('pc_id_name')}</div>
          <Field value={data.name}
                 placeholder={t('pc_id_name_ph')}
                 onChange={(v) => onChange({ name: v })} />
        </div>
        <div className="pc-row">
          <div className="pc-label mono">{t('pc_id_age')}</div>
          <Field value={data.age}
                 type="number"
                 mono
                 placeholder={t('pc_id_age_ph')}
                 onChange={(v) => onChange({ age: v })} />
        </div>
        <div className="pc-row">
          <div className="pc-label mono">{t('pc_id_city')}</div>
          <Field value={data.city}
                 placeholder={t('pc_id_city_ph')}
                 onChange={(v) => onChange({ city: v })} />
        </div>
        <div className="pc-row pc-row-wide">
          <div className="pc-label mono">{t('pc_id_bio')}</div>
          <Field value={data.bio}
                 placeholder={t('pc_id_bio_ph')}
                 multiline
                 onChange={(v) => onChange({ bio: v })} />
        </div>
      </div>
    </section>
  );
}

export { IdentityCard };
