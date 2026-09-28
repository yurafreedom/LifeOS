import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

/* global React */
const { useContext: useCtxHero } = React;

const HERO_DAY_SCENE = '/assets/scene/island-day.jpg';
const HERO_NIGHT_SCENE = '/assets/scene/island-night.jpg';

/* Approved Claude Design handoff, variant 1b. The media is decorative;
   the heading remains the accessible name for the page section. */
function HeroVignette({
  title,
  subtitle = null,
  date = null,
  sceneSrc = HERO_DAY_SCENE,
  nightSceneSrc = HERO_NIGHT_SCENE,
  tall = false,
  aside = null,
}) {
  return (
    <header className={'hero-scene' + (tall ? ' hero-scene--tall' : '')}>
      <div className="hero-scene__media-wrap" aria-hidden="true">
        <img
          className="hero-scene__media hero-scene__media--day"
          src={sceneSrc}
          alt=""
          decoding="async"
        />
        {nightSceneSrc ? (
          <img
            className="hero-scene__media hero-scene__media--night"
            src={nightSceneSrc}
            alt=""
            decoding="async"
          />
        ) : null}
      </div>
      <div className="hero-head">
        {date ? <p className="hero-head__date">{date}</p> : null}
        <div className="hero-head__content">
          <div className="hero-head__copy">
            <h2 className="hero-head__title">{title}</h2>
            {subtitle ? <p className="hero-head__sub">{subtitle}</p> : null}
          </div>
          {aside ? <div className="hero-head__aside">{aside}</div> : null}
        </div>
      </div>
    </header>
  );
}

/* Preserve the existing compact header in dark/light. Paradise is the only
   theme with the decorative scene, so it alone opts into the vignette. */
function PageHeader({ title, subtitle = null, date = null, tall = false, aside = null }) {
  const { themeEff } = useCtxHero(LifeLocaleContext);

  if (themeEff === 'paradise') {
    return (
      <HeroVignette
        title={title}
        subtitle={subtitle}
        date={date}
        tall={tall}
        aside={aside}
      />
    );
  }

  return (
    <header className="page-head">
      <div className="page-head-left">
        <h2 className="page-title">{title}</h2>
        {subtitle ? <div className="page-sub mono">{subtitle}</div> : null}
      </div>
      {aside}
    </header>
  );
}

export { HERO_DAY_SCENE, HERO_NIGHT_SCENE, HeroVignette, PageHeader };
