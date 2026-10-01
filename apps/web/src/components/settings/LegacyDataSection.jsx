import React from 'react';
import { downloadRaw } from '../StateImportPrompt.jsx';
import {
  deleteLegacyCopies,
  readLegacyLocalState,
  readRetiredLegacyState,
  restoreRetiredLegacyState,
  retireLegacyState,
} from '../../repositories/legacyLocalImport.ts';
import { Row } from './Row.jsx';

/* The old local-only snapshot on this device (JENKIN S1). It belongs to no
   account, so downloading it needs an explicit ownership confirmation;
   retiring moves it aside (recoverable); deleting is permanent and confirmed.
   Renders nothing when the device holds no such copy. */
export function LegacyDataSection({ t }) {
  const [version, setVersion] = React.useState(0);
  const [owned, setOwned] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const live = React.useMemo(() => readLegacyLocalState(), [version]);
  const retired = React.useMemo(() => readRetiredLegacyState(), [version]);
  const hasLive = live.kind !== 'absent' && live.raw != null;
  if (!hasLive && !retired) return null;
  const refresh = () => { setVersion(value => value + 1); setConfirmDelete(false); };
  const raw = hasLive ? live.raw : retired.raw;
  return (
    <React.Fragment>
      <div className="set-subhead mono">{t('set_legacy_head')}</div>
      <p className="set-row-hint set-legacy-copy">{t(hasLive ? 'set_legacy_live' : 'set_legacy_retired')}</p>
      <label className="import-own">
        <input type="checkbox" checked={owned} onChange={event => setOwned(event.target.checked)} />
        <span>{t('set_legacy_owner')}</span>
      </label>
      <Row label={t('set_legacy_download')}>
        <button className="set-btn-ghost" disabled={!owned}
                onClick={() => downloadRaw(raw, hasLive ? 'lifeOsState-legacy.json' : 'lifeOsState-legacy-retired.json')}>
          {t('set_download')}
        </button>
      </Row>
      {hasLive && (
        <Row label={t('set_legacy_retire')} hint={t('set_legacy_retire_hint')}>
          <button className="set-btn-ghost" onClick={() => { retireLegacyState('user_retired'); refresh(); }}>{t('set_legacy_retire_btn')}</button>
        </Row>
      )}
      {!hasLive && retired && (
        <Row label={t('set_legacy_restore')} hint={t('set_legacy_restore_hint')}>
          <button className="set-btn-ghost" onClick={() => { restoreRetiredLegacyState(); refresh(); }}>{t('set_legacy_restore_btn')}</button>
        </Row>
      )}
      <Row label={t('set_legacy_delete')} hint={t('set_legacy_delete_hint')}>
        {!confirmDelete
          ? <button className="set-btn-ghost" onClick={() => setConfirmDelete(true)}>{t('set_legacy_delete_btn')}</button>
          : (
            <div className="set-clear-confirm">
              <button className="set-btn-ghost" onClick={() => setConfirmDelete(false)}>{t('qa_cancel')}</button>
              <button className="set-btn-danger" onClick={() => { deleteLegacyCopies('both'); refresh(); }}>{t('set_legacy_delete_confirm')}</button>
            </div>
          )}
      </Row>
    </React.Fragment>
  );
}
