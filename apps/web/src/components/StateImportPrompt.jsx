import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

function downloadRaw(raw, filename) {
  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StateImportPrompt({ legacy, preview, error, busy, onImport, onFresh }) {
  const { t } = React.useContext(LifeLocaleContext);
  const invalid = legacy.kind === 'invalid';
  return (
    <main className="auth-screen">
      <section className="auth-card import-card" aria-labelledby="import-title">
        <p className="auth-eyebrow mono">{t('import_eyebrow')}</p>
        <h1 id="import-title">{invalid ? t('import_invalid_title') : t('import_title')}</h1>
        <p className="auth-copy">{invalid ? t('import_invalid_copy') : t('import_copy')}</p>
        {!invalid && preview && (
          <dl className="import-preview mono">
            {Object.entries(preview).map(([key, value]) => <div key={key}><dt>{t(`import_${key}`)}</dt><dd>{value}</dd></div>)}
          </dl>
        )}
        {error && <div className="auth-error" role="alert">{String(error.message || error)}</div>}
        <div className="import-actions">
          {!invalid && <button className="auth-submit" disabled={busy} onClick={onImport}>{t('import_use_local')}</button>}
          <button className="set-btn-ghost" disabled={busy} onClick={onFresh}>{t('import_start_fresh')}</button>
          {legacy.raw != null && (
            <button className="auth-link auth-link-button" onClick={() => downloadRaw(legacy.raw, 'lifeOsState-legacy.json')}>
              {t('import_download_raw')}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

export { StateImportPrompt };
