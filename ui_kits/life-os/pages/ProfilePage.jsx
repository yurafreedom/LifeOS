/* global React */
const { useContext: useCtxPP } = React;

/* Profile / Me page.
   Cards are individual components under profile/cards/. To add a new
   card: write the component, mount it onto window, and add one line
   to the CARDS array below. Each card receives its slice of profile
   data + an update callback that does a shallow merge into that slice. */
function ProfilePage({ profile, onUpdate }) {
  const { t } = useCtxPP(window.LifeLocaleContext);

  const CARDS = [
    { id: 'identity',     comp: window.IdentityCard,         slice: 'identity'     },
    { id: 'body',         comp: window.BodyMetricsCard,      slice: 'body'         },
    { id: 'measurements', comp: window.MeasurementsCard,     slice: 'measurements' },
    { id: 'sizes',        comp: window.ClothingSizesCard,    slice: 'sizes'        },
    { id: 'food',         comp: window.FoodPreferencesCard,  slice: 'food'         },
  ];

  return (
    <div className="page profile-page">
      <header className="page-head">
        <div className="page-head-left">
          <h2 className="page-title">{t('profile_title')}</h2>
          <div className="page-sub mono">{t('profile_subtitle')}</div>
        </div>
      </header>

      <div className="profile-cards">
        {CARDS.map(c => {
          const Comp = c.comp;
          if (!Comp) return null;
          return (
            <Comp key={c.id}
                  data={profile[c.slice]}
                  onChange={(patch) => onUpdate(c.slice, patch)} />
          );
        })}
      </div>

      <button className="profile-add-section" disabled
              title={t('profile_add_disabled')}>
        {t('profile_add_section')}
      </button>
    </div>
  );
}

window.ProfilePage = ProfilePage;
