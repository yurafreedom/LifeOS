import React from 'react';
import { exportAccount } from '../../api/exportAccount';
import { exportDocuments, getDocumentStatus, saveBlob } from '../../api/documents.ts';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import { LegacyDataSection } from './LegacyDataSection.jsx';
import { Row } from './Row.jsx';

const { useState: useStateSet } = React;

/* Account ZIP export (server) and snapshot JSON download. */
export function ExportSection({ t }) {
  const data = React.useContext(LifeDataContext);
  const [exporting, setExporting] = useStateSet(false);
  const [exportError, setExportError] = useStateSet('');
  /* Aborted when the section unmounts (route change, account switch); a ZIP
     that settles after the tab's account changed is discarded by the bound
     fetch and never offered as a file (api/accountBinding.ts). */
  const controllerRef = React.useRef(null);
  React.useEffect(() => () => controllerRef.current?.abort(), []);
  async function exportServer() {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    const controller = new window.AbortController();
    controllerRef.current = controller;
    try {
      const blob = await exportAccount(controller.signal);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'lifeos-account.zip';
      document.body.appendChild(anchor);
      try { anchor.click(); } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setExportError(t('set_export_account_error'));
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  }
  function exportJson() {
    const blob = new Blob([data.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'lifeOsState-server.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <React.Fragment>
      <DocumentsExportRow t={t} />
      <Row label={t('set_export_json')} hint={t('set_export_server_hint')}><button className="set-btn-ghost" onClick={exportJson}>{t('set_download')}</button></Row>
      <Row label={t('set_export_account')} hint={t('set_export_account_hint')}>
        <button className="set-btn-ghost" disabled={exporting} onClick={exportServer}>
          {t(exporting ? 'set_export_account_loading' : 'set_export_account_download')}
        </button>
      </Row>
      {exportError ? <p role="alert">{exportError}</p> : null}
      <LegacyDataSection t={t} />
    </React.Fragment>
  );
}

/* JENKIN S2: decrypted documents leave only on this explicit request, as their
   own streamed ZIP (the server writes no temporary file for it). Shown only when
   the server has document storage enabled. */
function DocumentsExportRow({ t }) {
  const [enabled, setEnabled] = useStateSet(false);
  const [busy, setBusy] = useStateSet(false);
  const [error, setError] = useStateSet('');
  const controllerRef = React.useRef(null);
  React.useEffect(() => {
    const controller = new window.AbortController();
    getDocumentStatus(controller.signal)
      .then(status => setEnabled(!!status.enabled))
      .catch(() => {});
    return () => { controller.abort(); controllerRef.current?.abort(); };
  }, []);
  if (!enabled) return null;
  async function run() {
    if (busy) return;
    setBusy(true);
    setError('');
    const controller = new window.AbortController();
    controllerRef.current = controller;
    try {
      saveBlob(await exportDocuments(controller.signal), 'jenkin-documents.zip');
    } catch (failure) {
      if (failure?.name === 'AbortError') return;
      setError(t('set_export_documents_error'));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <React.Fragment>
      <Row label={t('set_export_documents')} hint={t('set_export_documents_hint')}>
        <button className="set-btn-ghost" disabled={busy} onClick={run}>
          {t(busy ? 'set_export_documents_loading' : 'set_export_documents_download')}
        </button>
      </Row>
      {error ? <p role="alert">{error}</p> : null}
    </React.Fragment>
  );
}
