/* global React */
const { useState: useStateApp, useEffect: useEffectApp } = React;

const AA_SURFACES = [
  { key: 'home', label: 'A · Дом', theme: 'paradise' },
  { key: 'signals', label: 'B · Signal Card', theme: 'light' },
  { key: 'delta', label: 'C · Ожидалось / факт', theme: 'light' },
  { key: 'metric', label: 'D · История показателя', theme: 'light' },
  { key: 'project', label: 'D · История прогноза', theme: 'light' },
  { key: 'review', label: 'E · Ревью', theme: 'light' },
  { key: 'finance-page', label: 'F · Финансы (домен)', theme: 'light' },
  { key: 'project-page', label: 'G · Проект (домен)', theme: 'light' },
  { key: 'experiment', label: 'I · Эксперимент (future)', theme: 'light' },
  { key: 'tradeoff', label: 'J · Компромиссы (future)', theme: 'light' },
  { key: 'system', label: 'J · Обзор системы (future)', theme: 'light' }
];

function AAApp() {
  const [surface, setSurface] = useStateApp('home');
  const [scenario, setScenario] = useStateApp('three');
  const [device, setDevice] = useStateApp('desktop');
  const narrow = device === 'mobile';
  const cur = AA_SURFACES.find(s => s.key === surface) || AA_SURFACES[0];

  useEffectApp(() => {
    document.documentElement.setAttribute('data-theme', cur.theme);
    if (cur.theme === 'paradise') document.documentElement.setAttribute('data-scene', 'day');
    else document.documentElement.removeAttribute('data-scene');
  }, [cur.theme]);

  const content = (
    surface === 'home' ? <AAHome scenario={scenario} narrow={narrow} onOpenMetric={m => setSurface(m === 'project' ? 'project-page' : 'finance-page')} onOpenReview={() => setSurface('review')} />
    : surface === 'finance-page' ? <AAFinancePage narrow={narrow} onHistory={() => setSurface('metric')} onReview={() => setSurface('review')} />
    : surface === 'project-page' ? <AAProjectPage narrow={narrow} onHistory={() => setSurface('project')} onReview={() => setSurface('review')} />
    : surface === 'signals' ? <AASignalStates narrow={narrow} />
    : surface === 'delta' ? <AADeltaStates narrow={narrow} />
    : surface === 'review' ? <AAReview narrow={narrow} onBack={() => setSurface('home')} />
    : surface === 'experiment' ? <AAExperiment narrow={narrow} onBack={() => setSurface('home')} onReview={() => setSurface('review')} />
    : surface === 'tradeoff' ? <AATradeoffView narrow={narrow} onBack={() => setSurface('home')} onSystem={() => setSurface('system')} />
    : surface === 'system' ? <AASystemReview narrow={narrow} onBack={() => setSurface('home')} onTradeoff={() => setSurface('tradeoff')} onReview={() => setSurface('review')} />
    : <AAMetric which={surface === 'project' ? 'project' : 'finance'} narrow={narrow} onBack={() => setSurface(surface === 'project' ? 'project-page' : 'finance-page')} onReview={() => setSurface('review')} />
  );

  const scene = cur.theme === 'paradise' ? {
    backgroundImage: 'url(../../assets/scene/island-day.jpg)',
    backgroundSize: 'cover', backgroundPosition: 'center'
  } : { background: 'var(--bg-2)' };

  return (
    <div className="aa-shell">
      <aside className="aa-rail">
        <div className="aa-rail-group">
          <span className="aa-eyebrow">adaptive analytics</span>
          <span className="aa-quiet" style={{ fontSize: 11 }}>наблюдать → сравнить → понять → учиться</span>
        </div>
        <div className="aa-rail-group">
          <span className="aa-eyebrow">поверхность</span>
          {AA_SURFACES.map(s => (
            <button key={s.key} type="button" className={'aa-rail-btn' + (surface === s.key ? ' is-on' : '')} onClick={() => setSurface(s.key)}>{s.label}</button>
          ))}
        </div>
        {surface === 'home' && (
          <div className="aa-rail-group">
            <span className="aa-eyebrow">сценарий дома</span>
            {[['none', 'без сигналов'], ['one', 'один сигнал'], ['three', 'три сигнала']].map(([k, lab]) => (
              <button key={k} type="button" className={'aa-rail-btn' + (scenario === k ? ' is-on' : '')} onClick={() => setScenario(k)}>{lab}</button>
            ))}
          </div>
        )}
        <div className="aa-rail-group">
          <span className="aa-eyebrow">устройство</span>
          {[['desktop', 'десктоп'], ['mobile', 'мобильный']].map(([k, lab]) => (
            <button key={k} type="button" className={'aa-rail-btn' + (device === k ? ' is-on' : '')} onClick={() => setDevice(k)}>{lab}</button>
          ))}
        </div>
        <div className="aa-rail-group">
          <span className="aa-quiet" style={{ fontSize: 10, lineHeight: 1.5 }}>Дом — тема paradise. Аналитические поверхности — светлая тема.</span>
        </div>
      </aside>

      {narrow ? (
        <div className="aa-stage aa-stage-mobile" style={{ ...scene }}>
          <div className="aa-phone" style={{ ...scene }}>
            <span className="aa-phone-notch" />
            <div className="aa-phone-scroll" style={cur.theme === 'paradise' ? null : { background: 'var(--bg-2)' }}>{content}</div>
          </div>
        </div>
      ) : (
        <main className="aa-stage" style={{ ...scene }}>{content}</main>
      )}
    </div>
  );
}

window.AAApp = AAApp;
