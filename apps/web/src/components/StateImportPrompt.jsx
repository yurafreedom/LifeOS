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

/* The old local-only snapshot belongs to no account (JENKIN S1). Nothing about
   it — counts, the file itself, its contents — is previewed, downloaded or
   imported until the person confirms it is theirs and names the destination
   account. «Начать с пустого аккаунта» never touches the local copy. */
function StateImportPrompt({ legacy, buildPreview, accountEmail, error, busy, onImport, onFresh }) {
  const { t } = React.useContext(LifeLocaleContext);
  const [owned, setOwned] = React.useState(false);
  const invalid = legacy.kind === 'invalid';
  const preview = React.useMemo(
    () => (owned && !invalid && buildPreview ? buildPreview() : null),
    [owned, invalid, buildPreview],
  );
  return (
    <main className="auth-screen">
      <section className="auth-card import-card" aria-labelledby="import-title">
        <p className="auth-eyebrow mono">{t('import_eyebrow')}</p>
        <h1 id="import-title">{invalid ? t('import_invalid_title') : t('import_title')}</h1>
        <p className="auth-copy">{invalid ? t('import_invalid_copy') : t('import_copy_owned', accountEmail || '')}</p>
        <label className="import-own">
          <input type="checkbox" checked={owned} onChange={event => setOwned(event.target.checked)} />
          <span>{t('import_confirm_owner', accountEmail || '')}</span>
        </label>
        {preview && (
          <dl className="import-preview mono">
            {Object.entries(preview).map(([key, value]) => <div key={key}><dt>{t(`import_${key}`)}</dt><dd>{value}</dd></div>)}
          </dl>
        )}
        {error && <div className="auth-error" role="alert">{String(error.message || error)}</div>}
        <div className="import-actions">
          {!invalid && (
            <button className="auth-submit" disabled={busy || !owned} onClick={onImport}>{t('import_use_local')}</button>
          )}
          <button className="set-btn-ghost" disabled={busy} onClick={onFresh}>{t('import_start_empty')}</button>
          {legacy.raw != null && (
            <button className="auth-link auth-link-button" disabled={!owned}
                    onClick={() => downloadRaw(legacy.raw, 'lifeOsState-legacy.json')}>
              {t('import_download_raw')}
            </button>
          )}
        </div>
        <p className="auth-copy import-note">{t('import_keep_note')}</p>
      </section>
    </main>
  );
}

export { StateImportPrompt, downloadRaw };
