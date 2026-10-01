import React from 'react';
import { LifeLocaleContext } from '../context/LocaleContext.jsx';
import { useDialog } from './useDialog.js';

/* Voluntary logout with edits the server has not acknowledged (JENKIN S1).
   Never a silent loss and never a trap: retry the save, download a copy, sign
   out keeping a device copy for this account only, or sign out discarding the
   edits — the last one behind an explicit confirmation. */
function LogoutPendingPanel({ busy, error, onRetry, onDownload, onKeepAndLogout, onDiscardAndLogout, onCancel }) {
  const { t } = React.useContext(LifeLocaleContext);
  const [confirmDiscard, setConfirmDiscard] = React.useState(false);
  const panelRef = React.useRef(null);
  useDialog(panelRef, { onClose: () => { if (!busy) onCancel(); } });
  return (
    <div className="qa-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div className="qa-modal logout-pending" role="dialog" aria-modal="true"
           aria-labelledby="logout-pending-title" ref={panelRef} tabIndex={-1}>
        <h2 id="logout-pending-title" className="logout-pending-title">{t('logout_pending_title')}</h2>
        <p className="auth-copy">{t('logout_pending_copy')}</p>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <div className="import-actions">
          <button className="auth-submit" disabled={busy} onClick={onRetry}>{t('logout_pending_retry')}</button>
          <button className="set-btn-ghost" disabled={busy} onClick={onDownload}>{t('logout_pending_download')}</button>
          <button className="set-btn-ghost" disabled={busy} onClick={onKeepAndLogout}>{t('logout_pending_keep')}</button>
          {!confirmDiscard
            ? <button className="set-btn-ghost" disabled={busy} onClick={() => setConfirmDiscard(true)}>{t('logout_pending_discard')}</button>
            : <button className="set-btn-danger" disabled={busy} onClick={onDiscardAndLogout}>{t('logout_pending_discard_confirm')}</button>}
          <button className="set-btn-ghost" disabled={busy} onClick={onCancel}>{t('qa_cancel')}</button>
        </div>
      </div>
    </div>
  );
}

function LogoutPendingDialog({ open, ...props }) {
  return open ? <LogoutPendingPanel {...props} /> : null;
}

export { LogoutPendingDialog };
