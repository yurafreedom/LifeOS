import React from 'react';
import { LifeDataContext } from '../../context/LifeDataContext.jsx';
import { Row } from './Row.jsx';

const { useState: useStateSet } = React;

/* Server state reset (hard reset) and activity-history clearing. */
export function DangerSection({ t }) {
  const data = React.useContext(LifeDataContext);
  const [confirmCount, setConfirmCount] = useStateSet(null);   // months -> shows confirm row
  const [feedback, setFeedback]         = useStateSet('');
  const [resetConfirm, setResetConfirm] = useStateSet(false);
  const [resetBusy, setResetBusy] = useStateSet(false);

  function exportJson() {
    if (!data) return;
    const blob = new Blob([data.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lifeOsState.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clearHistory(months) {
    if (!data) return;
    const cutoff = new Date(Date.now() - months * 30 * 86400000).toISOString();
    const before = (data.state.activityLog || []).length;
    data.clearActivityOlderThan(cutoff);
    const after = Math.max(0, before - 0);   // we don't know after value synchronously
    /* approximate — we count rows older than the cutoff right now */
    const removed = (data.state.activityLog || []).filter(e => new Date(e.timestamp).getTime() < new Date(cutoff).getTime()).length;
    setFeedback(t('set_clear_done', removed));
    setConfirmCount(null);
    setTimeout(() => setFeedback(''), 3000);
  }
  async function resetServerState() {
    setResetBusy(true);
    setFeedback('');
    try {
      await data.hardReset();
      setResetConfirm(false);
      setFeedback(t('set_reset_done'));
    } catch {
      setFeedback(t('set_reset_failed'));
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <React.Fragment>
      <div className="set-danger-card">
        <div className="set-danger-msg">{t('set_danger_msg')}</div>
        {!resetConfirm ? (
          <button className="set-btn-danger" disabled={data.syncPhase === 'conflict'} onClick={() => setResetConfirm(true)}>{t('set_danger_btn')}</button>
        ) : (
          <div className="set-clear-confirm">
            <button className="set-btn-ghost" disabled={resetBusy} onClick={() => setResetConfirm(false)}>{t('qa_cancel')}</button>
            <button className="set-btn-danger" disabled={resetBusy} onClick={resetServerState}>{t('set_reset_confirm')}</button>
          </div>
        )}
        {feedback && <div className="set-row-hint mono">{feedback}</div>}
      </div>

      <div className="set-subhead mono">SPRINT 3A · STATE</div>
      <Row label={t('set_export_state')} hint={t('set_export_server_hint')}>
        <button className="set-btn-ghost" onClick={exportJson}>{t('set_export_json')} ↓</button>
      </Row>
      <Row label={t('set_clear_history')} hint={t('set_clear_history_hint')}>
        <div className="set-seg">
          <button className={"set-seg-btn" + (confirmCount === 3  ? " is-on" : "")} onClick={() => setConfirmCount(3)}>{t('set_clear_3mo')}</button>
          <button className={"set-seg-btn" + (confirmCount === 6  ? " is-on" : "")} onClick={() => setConfirmCount(6)}>{t('set_clear_6mo')}</button>
          <button className={"set-seg-btn" + (confirmCount === 12 ? " is-on" : "")} onClick={() => setConfirmCount(12)}>{t('set_clear_12mo')}</button>
        </div>
      </Row>
      {confirmCount != null && (
        <Row label="" hint={feedback || ''}>
          <div className="set-clear-confirm">
            <button className="set-btn-ghost" onClick={() => setConfirmCount(null)}>{t('qa_cancel')}</button>
            <button className="set-btn-danger" onClick={() => clearHistory(confirmCount)}>{t('set_clear_do')}</button>
          </div>
        </Row>
      )}
      {feedback && confirmCount == null && (
        <div className="set-subhead mono" style={{ color: 'var(--success)' }}>{feedback}</div>
      )}
    </React.Fragment>
  );
}
