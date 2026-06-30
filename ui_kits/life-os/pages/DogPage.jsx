/* global React */
const {
  useState: useStateDog,
  useContext: useCtxDog,
  useMemo: useMemoDog,
} = React;

/* Dog tab.
   Sprint 1 ships seed data + layout. The live reminders rail at the top
   shows mock countdowns; Sprint 3 will replace these with real timers
   bound to last-feed-at, last-walk-at, and the next vet visit date. */
function DogPage({ dog, onUpdate, locale, t }) {
  const I = window.LIcons;
  const Field = window.EditableField;

  const vetCountdown = useMemoDog(() => {
    const [d, m, y] = dog.vet.next.date.split('.').map(Number);
    const next = new Date(y, m - 1, d);
    const days = Math.max(0, Math.ceil((next - new Date()) / 86400000));
    return days;
  }, [dog.vet.next.date]);

  return (
    <div className="page dog-page">
      <header className="page-head">
        <div className="page-head-left">
          <h2 className="page-title">{t('dog_title')}</h2>
          <div className="page-sub mono">{t('dog_subtitle')}</div>
        </div>
      </header>

      {/* Live reminders rail */}
      <div className="dog-reminders">
        <span className="dog-reminder">
          <span className="dog-reminder-icon">{I.utensilsAlt({ size: 14 })}</span>
          {t('dog_rem_feed', dog.reminders.nextFeedIn)}
        </span>
        <span className="dog-reminder">
          <span className="dog-reminder-icon">{I.paw({ size: 14 })}</span>
          {t('dog_rem_walk', dog.reminders.nextWalkIn)}
        </span>
        <span className="dog-reminder">
          <span className="dog-reminder-icon">{I.syringe({ size: 14 })}</span>
          {t('dog_rem_vet', vetCountdown, t.pl('pl_day', vetCountdown))}
        </span>
      </div>

      <div className="dog-grid">
        {/* Pet profile */}
        <section className="pc-card dog-profile-card">
          <header className="pc-head">
            <h3 className="pc-title">{t('dog_pf')}</h3>
          </header>
          <div className="dog-profile-body">
            <div className="dog-avatar" title={t('dog_pf_photo_hint')}>
              <span className="dog-avatar-paw">{I.paw({ size: 38 })}</span>
              <span className="dog-avatar-hint mono">{t('dog_pf_photo')}</span>
            </div>
            <div className="dog-profile-fields">
              <div className="pc-row">
                <div className="pc-label mono">{t('dog_pf_name')}</div>
                {dog.profile.name
                  ? <Field value={dog.profile.name}
                           placeholder={t('dog_name_placeholder')}
                           onChange={v => onUpdate('profile', { name: v })} />
                  : <button className="dog-name-placeholder"
                            onClick={() => onUpdate('profile', { name: 'буква' })}
                            title={t('dog_name_placeholder')}>
                      {t('dog_name_placeholder')}
                    </button>
                }
              </div>
              <div className="pc-row">
                <div className="pc-label mono">{t('dog_pf_breed')}</div>
                <div className="dog-static">{dog.profile.breed[locale]}</div>
              </div>
              <div className="pc-row">
                <div className="pc-label mono">{t('dog_pf_birth')}</div>
                <Field value={dog.profile.birth}
                       placeholder={t('dog_unset')}
                       mono
                       onChange={v => onUpdate('profile', { birth: v })} />
              </div>
              <div className="pc-row">
                <div className="pc-label mono">{t('dog_pf_weight')}</div>
                <Field value={dog.profile.weight}
                       placeholder={t('dog_unset')}
                       mono
                       suffix="кг"
                       onChange={v => onUpdate('profile', { weight: v })} />
              </div>
            </div>
          </div>
        </section>

        {/* Feeding */}
        <section className="pc-card">
          <header className="pc-head">
            <h3 className="pc-title">{t('dog_feed')}</h3>
            <span className="pc-sub mono">{t('dog_feed_sub')}</span>
          </header>
          <div className="dog-meals">
            {dog.feeding.meals.map((meal, i) => (
              <div className="dog-meal-row" key={meal.id}>
                <div className="dog-meal-num mono">{i + 1}</div>
                <Field value={meal.time}
                       type="time"
                       mono
                       onChange={v => onUpdate('feeding', { meals: dog.feeding.meals.map(m => m.id === meal.id ? { ...m, time: v } : m) })} />
                <Field value={meal.portion}
                       mono
                       placeholder={t('dog_feed_portion_ph')}
                       suffix="г"
                       onChange={v => onUpdate('feeding', { meals: dog.feeding.meals.map(m => m.id === meal.id ? { ...m, portion: v } : m) })} />
                <button className="dog-feed-btn mono" type="button"
                        title={t('dog_feed_feed_now')}>
                  {I.check({ size: 12 })}
                  <span>{t('dog_feed_feed_now')}</span>
                </button>
              </div>
            ))}
          </div>
          <a className="dog-meal-history mono" href="#" onClick={e => e.preventDefault()}>
            {t('dog_feed_history')}
          </a>
        </section>

        {/* Inventory */}
        <section className="pc-card">
          <header className="pc-head">
            <h3 className="pc-title">{t('dog_inv')}</h3>
          </header>
          <div className="dog-inv">
            {dog.inventory.food.totalG ? (
              <div className="dog-inv-row">
                <div className="dog-inv-name">{t('dog_inv_food')}</div>
                <div className="dog-inv-track">
                  <div className="dog-inv-track-bar"
                       style={{ width: (dog.inventory.food.remainingG / dog.inventory.food.totalG * 100) + '%' }} />
                </div>
                <div className="dog-inv-meta mono">
                  {`${dog.inventory.food.remainingG}г / ${dog.inventory.food.totalG}г`}
                </div>
              </div>
            ) : (
              <div className="dog-inv-row dog-inv-row-empty">
                <div className="dog-inv-name">{t('dog_inv_food')}</div>
                <button className="dog-inv-empty-link mono"
                        type="button"
                        onClick={() => onUpdate('inventory', { food: { ...dog.inventory.food, totalG: 7000, remainingG: 7000 } })}>
                  {t('dog_inv_food_empty')}
                </button>
              </div>
            )}
            <div className="dog-inv-secondary">
              <div className="dog-inv-secondary-row">
                <span>{t('dog_inv_treats')}</span>
                <span className="mono">{t('dog_inv_empty')}</span>
              </div>
              <div className="dog-inv-secondary-row">
                <span>{t('dog_inv_hygiene')}</span>
                <span className="mono">{t('dog_inv_empty')}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Vet */}
        <section className="pc-card">
          <header className="pc-head">
            <h3 className="pc-title">{t('dog_vet')}</h3>
          </header>
          <div className="dog-vet">
            <div className="dog-vet-block">
              <div className="pc-label mono">{t('dog_vet_last')}</div>
              <Field value={dog.vet.last.date}
                     mono
                     onChange={v => onUpdate('vet', { last: { ...dog.vet.last, date: v } })} />
              <div className="dog-vet-note">{dog.vet.last['note_' + locale]}</div>
            </div>
            <div className="dog-vet-block is-next">
              <div className="pc-label mono">{t('dog_vet_next')}</div>
              <Field value={dog.vet.next.date}
                     mono
                     onChange={v => onUpdate('vet', { next: { ...dog.vet.next, date: v } })} />
              <div className="dog-vet-note">{dog.vet.next['note_' + locale]}</div>
            </div>
          </div>
        </section>

        {/* Tasks */}
        <section className="pc-card">
          <header className="pc-head">
            <h3 className="pc-title">{t('dog_tasks')}</h3>
          </header>
          {dog.tasks.length === 0 ? (
            <div className="dog-empty">{t('dog_tasks_empty')}</div>
          ) : (
            <div>{/* Sprint 3 will render dog-tagged tasks here */}</div>
          )}
        </section>

        {/* Monthly expenses */}
        <section className="pc-card">
          <header className="pc-head">
            <h3 className="pc-title">{t('dog_exp')}</h3>
            <span className="pc-sub mono">{t('dog_exp_zero')} / MONTH</span>
          </header>
          <div className="dog-empty">{t('dog_exp_empty')}</div>
        </section>
      </div>
    </div>
  );
}

window.DogPage = DogPage;
