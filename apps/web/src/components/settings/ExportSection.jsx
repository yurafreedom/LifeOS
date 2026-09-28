import React from 'react';
import { exportAccount } from '../../api/exportAccount';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import { Row } from './Row.jsx';

const { useState: useStateSet } = React;

/* Account ZIP export (server) and snapshot JSON download. */
export function ExportSection({ t }) {
  const data = React.useContext(LifeDataContext);
  const [exporting, setExporting] = useStateSet(false);
  const [exportError, setExportError] = useStateSet('');
  async function exportServer() {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const blob = await exportAccount();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'lifeos-account.zip';
      document.body.appendChild(anchor);
      try { anchor.click(); } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch {
      setExportError(t('set_export_account_error'));
    } finally {
      setExporting(false);
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
      <Row label={t('set_export_json')} hint={t('set_export_server_hint')}><button className="set-btn-ghost" onClick={exportJson}>download</button></Row>
      <Row label={t('set_export_account')} hint={t('set_export_account_hint')}>
        <button className="set-btn-ghost" disabled={exporting} onClick={exportServer}>
          {t(exporting ? 'set_export_account_loading' : 'set_export_account_download')}
        </button>
      </Row>
      {exportError ? <p role="alert">{exportError}</p> : null}
      <Row label={t('set_export_csv')}  hint=".csv · 12 KB"><button className="set-btn-ghost">download</button></Row>
      <Row label={t('set_export_md')}   hint=".md · 24 KB"><button className="set-btn-ghost">download</button></Row>
    </React.Fragment>
  );
}
