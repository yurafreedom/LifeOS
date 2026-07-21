import React from 'react';
import { LifeLocaleContext } from '../../context/LocaleContext.jsx';
import { lifeConvertSize } from '../../data/profile.js';
import { EditableField } from '../EditableField.jsx';

/* global React */
const { useContext: useCtxCS } = React;

/* Clothing sizes — EU is the source of truth, US + UA/UK are derived
   via lifeConvertSize(type, eu). Edit the EU column and the
   other two cells auto-update. */
function ClothingSizesCard({ data, onChange }) {
  const { t } = useCtxCS(LifeLocaleContext);
  const Field = EditableField;

  const rows = [
    { key: 'shirt',  label: t('pc_sizes_shirt')  },
    { key: 'pants',  label: t('pc_sizes_pants')  },
    { key: 'jacket', label: t('pc_sizes_jacket') },
    { key: 'shoes',  label: t('pc_sizes_shoes')  },
    { key: 'suit',   label: t('pc_sizes_suit')   },
    { key: 'tshirt', label: t('pc_sizes_tshirt') },
  ];

  return (
    <section className="pc-card pc-card-wide">
      <header className="pc-head">
        <h3 className="pc-title">{t('pc_sizes')}</h3>
        <span className="pc-sub mono">{t('pc_sizes_sub')}</span>
      </header>
      <div className="pc-body">
        <div className="pc-sizes-table">
          <div className="pc-sizes-head mono">
            <span>{t('pc_sizes_type')}</span>
            <span>EU</span>
            <span>US</span>
            <span>UA/UK</span>
          </div>
          {rows.map(r => {
            const eu = data[r.key];
            const conv = lifeConvertSize(r.key, eu);
            return (
              <div className="pc-sizes-row" key={r.key}>
                <span className="pc-sizes-type">{r.label}</span>
                <Field value={eu}
                       type="number"
                       mono
                       width={68}
                       onChange={(v) => onChange({ [r.key]: v })} />
                <span className="pc-sizes-derived mono">{conv.us}</span>
                <span className="pc-sizes-derived mono">{conv.alt}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { ClothingSizesCard };
