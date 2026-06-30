/* global React */
const { useState: useStateFP, useContext: useCtxFP } = React;

/* Food preferences — allergies, likes, dislikes are tag lists with
   inline add/remove. Plus a freeform notes textarea at the bottom. */
function FoodPreferencesCard({ data, onChange }) {
  const { t } = useCtxFP(window.LifeLocaleContext);
  const Field = window.EditableField;

  return (
    <section className="pc-card pc-card-wide">
      <header className="pc-head">
        <h3 className="pc-title">{t('pc_food')}</h3>
      </header>
      <div className="pc-body pc-food-body">
        <FoodTagGroup
          label={t('pc_food_allergies')}
          placeholder={t('pc_food_allergies_ph')}
          tags={data.allergies}
          onChange={(next) => onChange({ allergies: next })}
          tone="danger" />
        <div className="pc-food-cols">
          <FoodTagGroup
            label={t('pc_food_likes')}
            placeholder={t('pc_food_tag_ph')}
            tags={data.likes}
            onChange={(next) => onChange({ likes: next })}
            tone="ok" />
          <FoodTagGroup
            label={t('pc_food_dislikes')}
            placeholder={t('pc_food_tag_ph')}
            tags={data.dislikes}
            onChange={(next) => onChange({ dislikes: next })}
            tone="muted" />
        </div>
        <div className="pc-row pc-row-wide">
          <div className="pc-label mono">{t('pc_food_notes')}</div>
          <Field value={data.notes}
                 placeholder={t('pc_food_notes_ph')}
                 multiline
                 onChange={(v) => onChange({ notes: v })} />
        </div>
      </div>
    </section>
  );
}

function FoodTagGroup({ label, tags, placeholder, onChange, tone }) {
  const [draft, setDraft] = useStateFP('');
  function add(e) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onChange([...tags, v]);
    setDraft('');
  }
  function remove(idx) {
    onChange(tags.filter((_, i) => i !== idx));
  }
  return (
    <div className="pc-food-group">
      <div className="pc-label mono">{label}</div>
      <div className="pc-food-tags">
        {tags.map((tag, i) => (
          <span key={i} className={"pc-food-tag pc-food-tag-" + tone}>
            <span>{tag}</span>
            <button className="pc-food-tag-x"
                    onClick={() => remove(i)}
                    aria-label="remove">×</button>
          </span>
        ))}
        <form className="pc-food-add" onSubmit={add}>
          <input className="pc-food-add-input"
                 value={draft}
                 onChange={e => setDraft(e.target.value)}
                 placeholder={placeholder} />
        </form>
      </div>
    </div>
  );
}

window.FoodPreferencesCard = FoodPreferencesCard;
