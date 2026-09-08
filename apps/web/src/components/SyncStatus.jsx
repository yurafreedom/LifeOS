import React from 'react';
import { LifeDataContext } from '../context/LifeDataContext.jsx';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';

function SyncStatus({ compact = false }) {
  const data = React.useContext(LifeDataContext);
  const { t } = React.useContext(LifeLocaleContext);
  if (!data) return null;
  const phase = data.syncPhase || 'saved';
  const needsRecovery = phase === 'offline' || phase === 'error' || phase === 'conflict';
  function reloadServer() {
    if (window.confirm(t('sync_reload_confirm'))) void data.reloadServerState();
  }
  return (
    <div className={`sync-status sync-${phase}${compact ? ' is-compact' : ''}`} role={needsRecovery ? 'status' : undefined}>
      <span className="sync-dot" aria-hidden="true" />
      <span>{t(`sync_${phase}`)}</span>
      {!compact && (phase === 'offline' || phase === 'error') && (
        <button onClick={data.retrySync}>{t('sync_retry')}</button>
      )}
      {!compact && phase === 'conflict' && <>
        <button onClick={data.exportUnsaved}>{t('sync_export_unsaved')}</button>
        <button onClick={reloadServer}>{t('sync_reload_server')}</button>
      </>}
    </div>
  );
}

export { SyncStatus };
