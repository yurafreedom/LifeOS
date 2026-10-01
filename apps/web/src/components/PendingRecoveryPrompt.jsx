import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

/* Unsaved edits kept for THIS account on this device (pendingSnapshotStore).
   Shown only after signing in to the same account. Restoring is a
   compare-and-swap against the revision the edits were based on; when the
   server has moved on, the copy can still be downloaded or discarded, never
   silently merged. Skipping keeps the copy for later. */
function PendingRecoveryPrompt({ record, serverRevision, busy, error, onRestore, onDownload, onDiscard, onSkip }) {
  const { t, locale } = React.useContext(LifeLocaleContext);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const stale = record.base_revision !== serverRevision;
  const when = new Date(record.saved_at);
  const savedAt = Number.isNaN(when.getTime())
    ? record.saved_at
    : when.toLocaleString(locale === 'uk' ? 'uk-UA' : 'ru-RU', { timeZone: 'Europe/Kyiv' });
  return (
    <main className="auth-screen">
      <section className="auth-card import-card" aria-labelledby="recovery-title">
        <p className="auth-eyebrow mono">{t('recovery_eyebrow')}</p>
        <h1 id="recovery-title">{t('recovery_title')}</h1>
        <p className="auth-copy">{t('recovery_copy', savedAt)}</p>
        {stale && <p className="auth-copy" role="status">{t('recovery_stale')}</p>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <div className="import-actions">
          {!stale && <button className="auth-submit" disabled={busy} onClick={onRestore}>{t('recovery_restore')}</button>}
          <button className="set-btn-ghost" disabled={busy} onClick={onDownload}>{t('recovery_download')}</button>
          <button className="set-btn-ghost" disabled={busy} onClick={onSkip}>{t('recovery_later')}</button>
          {!confirmDiscard
            ? <button className="set-btn-ghost" disabled={busy} onClick={() => setConfirmDiscard(true)}>{t('recovery_discard')}</button>
            : <button className="set-btn-danger" disabled={busy} onClick={onDiscard}>{t('recovery_discard_confirm')}</button>}
        </div>
      </section>
    </main>
  );
}

export { PendingRecoveryPrompt };
