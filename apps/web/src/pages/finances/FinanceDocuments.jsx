import React from 'react';
import { ApiError } from '../../api/client.ts';
import {
  ACCEPTED_EXTENSIONS,
  deleteDocument,
  downloadDocument,
  getDocument,
  getDocumentStatus,
  listDocuments,
  newIdempotencyKey,
  saveBlob,
  updateDocument,
  uploadDocument,
  uploadVersion,
} from '../../api/documents.ts';
import { LifeLocaleContext } from '../../context/LocaleContext.jsx';

/* Finance → Документы (JENKIN S2). A plain, honest document collection:
   upload, list, download, descriptive metadata, content versions, deletion.
   It is not the future finance model — nothing here links a document to a
   loan, payment or obligation (that is F1).

   Every status shown is the server's answer. Requests are account-bound; this
   tree unmounts on an account change (providers are keyed), and every request
   it started is aborted, so a late answer can never appear under another
   account. */

const ACCEPTED = /\.(pdf|jpe?g|png)$/i;

const ERROR_KEYS = {
  document_too_large: 'doc_err_too_large',
  unsupported_document_type: 'doc_err_type',
  content_type_mismatch: 'doc_err_mismatch',
  malformed_document: 'doc_err_malformed',
  encrypted_pdf: 'doc_err_encrypted_pdf',
  empty_document: 'doc_err_empty',
  document_limit_reached: 'doc_err_limit',
  document_storage_full: 'doc_err_storage_full',
  revision_conflict: 'doc_err_conflict',
  idempotency_conflict: 'doc_err_generic',
  document_not_found: 'doc_err_not_found',
  document_key_unavailable: 'doc_err_key',
  document_integrity_failed: 'doc_err_integrity',
  documents_unavailable: 'doc_err_unavailable',
  documents_busy: 'doc_err_busy',
};

function errorText(error, t, maxMb) {
  if (error?.name === 'AbortError') return '';
  if (!(error instanceof ApiError)) return t('auth_network_error');
  const key = ERROR_KEYS[error.code];
  if (key === 'doc_err_too_large') return t(key, maxMb);
  return key ? t(key) : t('doc_err_generic');
}

function useFormatters() {
  const { locale } = React.useContext(LifeLocaleContext);
  const intl = locale === 'uk' ? 'uk-UA' : 'ru-RU';
  return React.useMemo(() => ({
    date(iso) {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleString(intl, {
        timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    },
    size(bytes, t) {
      if (bytes == null) return '—';
      if (bytes === 0) return t('doc_size_kb', '0');
      if (bytes < 1024 * 1024) {
        return t('doc_size_kb', Math.max(1, Math.round(bytes / 1024)).toLocaleString(intl));
      }
      return t('doc_size_mb', (bytes / (1024 * 1024)).toLocaleString(intl, { maximumFractionDigits: 1 }));
    },
  }), [intl]);
}

function typeLabel(contentType) {
  if (contentType === 'application/pdf') return 'PDF';
  if (contentType === 'image/jpeg') return 'JPEG';
  if (contentType === 'image/png') return 'PNG';
  return contentType || '—';
}

/* One controller per component; everything it started is aborted on unmount. */
function useAbortScope() {
  const controllers = React.useRef(new Set());
  React.useEffect(() => () => {
    for (const controller of controllers.current) controller.abort();
    controllers.current.clear();
  }, []);
  return React.useCallback(() => {
    const controller = new window.AbortController();
    controllers.current.add(controller);
    return {
      signal: controller.signal,
      done() { controllers.current.delete(controller); },
      get aborted() { return controller.signal.aborted; },
    };
  }, []);
}

function preCheck(file, status, t) {
  if (!file) return t('doc_err_pick');
  if (!ACCEPTED.test(file.name)) return t('doc_err_type');
  if (status && file.size > status.max_bytes) return t('doc_err_too_large', Math.round(status.max_bytes / 1048576));
  if (file.size === 0) return t('doc_err_empty');
  return '';
}

export function ProtectionNote({ t }) {
  return (
    <details className="doc-protection">
      <summary>{t('doc_protection_summary')}</summary>
      <ul>
        <li>{t('doc_protection_what')}</li>
        <li>{t('doc_protection_server')}</li>
        <li>{t('doc_protection_readable')}</li>
        <li>{t('doc_protection_backups')}</li>
        <li>{t('doc_protection_scan')}</li>
      </ul>
    </details>
  );
}

export function UploadPanel({ t, status, onUploaded }) {
  const scope = useAbortScope();
  const inputRef = React.useRef(null);
  const [file, setFile] = React.useState(null);
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  /* The key is minted once per chosen file, so "retry" after a lost answer
     cannot create a duplicate document. */
  const [key, setKey] = React.useState(null);
  const [state, setState] = React.useState({ phase: 'idle', message: '' });
  const maxMb = Math.round(status.max_bytes / 1048576);

  function choose(event) {
    const next = event.target.files?.[0] || null;
    setFile(next);
    setKey(next ? newIdempotencyKey() : null);
    setState({ phase: 'idle', message: next ? preCheck(next, status, t) : '' });
  }

  async function submit(event) {
    event.preventDefault();
    const problem = preCheck(file, status, t);
    if (problem) { setState({ phase: 'error', message: problem }); return; }
    setState({ phase: 'pending', message: t('doc_uploading') });
    const request = scope();
    try {
      const { record, created } = await uploadDocument(file, { title, notes }, key, request.signal);
      if (request.aborted) return;
      setFile(null); setTitle(''); setNotes(''); setKey(null);
      if (inputRef.current) inputRef.current.value = '';
      setState({ phase: 'done', message: created ? t('doc_uploaded', record.title || '') : t('doc_upload_replayed') });
      onUploaded();
    } catch (error) {
      if (request.aborted || error?.name === 'AbortError') return;
      const retryable = !(error instanceof ApiError) || error.status >= 500;
      setState({ phase: retryable ? 'retry' : 'error', message: errorText(error, t, maxMb) });
    } finally {
      request.done();
    }
  }

  const busy = state.phase === 'pending';
  return (
    <form className="card panel doc-upload" onSubmit={submit} aria-busy={busy}>
      <div className="panel-head">
        <h3 className="panel-title">{t('doc_upload_title')}</h3>
      </div>
      <p className="doc-guidance">{t('doc_upload_guidance', maxMb)}</p>
      <div className="sec-field">
        <span>{t('doc_file')}</span>
        {/* The native control's text follows the browser's language, not the
            app's; a localized label carries the visually hidden input. */}
        <div className="doc-file-row">
          <label className="set-btn-ghost doc-file-button">
            {t('doc_file_choose')}
            <input ref={inputRef} className="doc-visually-hidden" type="file" accept={ACCEPTED_EXTENSIONS}
                   onChange={choose} disabled={busy} />
          </label>
          <span className="doc-file-name">{file ? file.name : t('doc_file_none')}</span>
        </div>
      </div>
      <label className="sec-field">
        <span>{t('doc_title_label')}</span>
        <input className="set-input" type="text" maxLength={200} value={title} placeholder={t('doc_title_ph')}
               onChange={e => setTitle(e.target.value)} disabled={busy} />
      </label>
      <label className="sec-field">
        <span>{t('doc_notes_label')}</span>
        <textarea className="set-input doc-notes" maxLength={4000} rows={2} value={notes}
                  onChange={e => setNotes(e.target.value)} disabled={busy} />
      </label>
      {state.message && (
        <p className={state.phase === 'done' ? 'auth-success' : state.phase === 'pending' ? 'doc-pending' : 'auth-error'}
           role={state.phase === 'error' || state.phase === 'retry' ? 'alert' : 'status'}>
          {state.message}
        </p>
      )}
      <div className="doc-actions">
        <button className="set-btn-primary" type="submit" disabled={busy || !file}>
          {busy ? t('doc_uploading_short') : state.phase === 'retry' ? t('doc_retry') : t('doc_upload_submit')}
        </button>
      </div>
    </form>
  );
}

function VersionUpload({ t, doc, status, onChanged }) {
  const scope = useAbortScope();
  const inputRef = React.useRef(null);
  const [pending, setPending] = React.useState(null); // { file, key }
  const [state, setState] = React.useState({ phase: 'idle', message: '' });
  const maxMb = Math.round(status.max_bytes / 1048576);

  async function send(next) {
    const problem = preCheck(next.file, status, t);
    if (problem) { setState({ phase: 'error', message: problem }); return; }
    setState({ phase: 'pending', message: t('doc_uploading') });
    const request = scope();
    try {
      await uploadVersion(doc.id, next.file, doc.revision, next.key, request.signal);
      if (request.aborted) return;
      setPending(null);
      if (inputRef.current) inputRef.current.value = '';
      setState({ phase: 'done', message: t('doc_version_added') });
      onChanged();
    } catch (error) {
      if (request.aborted || error?.name === 'AbortError') return;
      if (error instanceof ApiError && error.code === 'revision_conflict') {
        setPending(null);
        setState({ phase: 'error', message: t('doc_err_conflict') });
        onChanged();
        return;
      }
      const retryable = !(error instanceof ApiError) || error.status >= 500;
      setState({ phase: retryable ? 'retry' : 'error', message: errorText(error, t, maxMb) });
    } finally {
      request.done();
    }
  }

  function choose(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const next = { file, key: newIdempotencyKey() };
    setPending(next);
    send(next);
  }

  return (
    <div className="doc-version-upload">
      <label className="set-btn-ghost doc-file-button">
        {t('doc_version_upload')}
        <input ref={inputRef} type="file" accept={ACCEPTED_EXTENSIONS} className="doc-visually-hidden"
               onChange={choose} disabled={state.phase === 'pending'} />
      </label>
      {state.phase === 'retry' && pending && (
        <button type="button" className="set-btn-ghost" onClick={() => send(pending)}>{t('doc_retry')}</button>
      )}
      {state.message && (
        <p className={state.phase === 'done' ? 'auth-success' : state.phase === 'pending' ? 'doc-pending' : 'auth-error'}
           role={state.phase === 'error' || state.phase === 'retry' ? 'alert' : 'status'}>{state.message}</p>
      )}
    </div>
  );
}

function DocumentDetails({ t, summary, status, onChanged, onDeleted }) {
  const fmt = useFormatters();
  const scope = useAbortScope();
  const [doc, setDoc] = React.useState(null);
  const [loadError, setLoadError] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [saveState, setSaveState] = React.useState({ phase: 'idle', message: '' });
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleteState, setDeleteState] = React.useState({ busy: false, message: '' });
  const [downloadError, setDownloadError] = React.useState('');
  const maxMb = Math.round(status.max_bytes / 1048576);

  const load = React.useCallback(async () => {
    const request = scope();
    try {
      const fresh = await getDocument(summary.id, request.signal);
      if (request.aborted) return;
      setDoc(fresh);
      setTitle(fresh.title || '');
      setNotes(fresh.notes || '');
      setLoadError('');
    } catch (error) {
      if (request.aborted || error?.name === 'AbortError') return;
      setLoadError(errorText(error, t, maxMb));
    } finally {
      request.done();
    }
  }, [scope, summary.id, t, maxMb]);

  React.useEffect(() => { load(); }, [load, summary.revision]);

  async function save(event) {
    event.preventDefault();
    if (!doc) return;
    if (!title.trim()) { setSaveState({ phase: 'error', message: t('doc_err_title_empty') }); return; }
    setSaveState({ phase: 'pending', message: '' });
    const request = scope();
    try {
      const fresh = await updateDocument(doc.id, { expected_revision: doc.revision, title, notes }, request.signal);
      if (request.aborted) return;
      setDoc(fresh);
      setSaveState({ phase: 'done', message: t('doc_saved') });
      onChanged();
    } catch (error) {
      if (request.aborted || error?.name === 'AbortError') return;
      setSaveState({ phase: 'error', message: errorText(error, t, maxMb) });
      if (error instanceof ApiError && error.code === 'revision_conflict') onChanged();
    } finally {
      request.done();
    }
  }

  async function download(number) {
    setDownloadError('');
    const request = scope();
    try {
      const { blob, filename } = await downloadDocument(doc.id, number, request.signal);
      if (request.aborted) return;
      saveBlob(blob, filename);
    } catch (error) {
      if (request.aborted || error?.name === 'AbortError') return;
      setDownloadError(errorText(error, t, maxMb));
    } finally {
      request.done();
    }
  }

  async function remove() {
    setDeleteState({ busy: true, message: '' });
    const request = scope();
    try {
      await deleteDocument(doc.id, doc.revision, request.signal);
      if (request.aborted) return;
      onDeleted(doc.id);
    } catch (error) {
      if (request.aborted || error?.name === 'AbortError') return;
      setDeleteState({ busy: false, message: errorText(error, t, maxMb) });
      setConfirmDelete(false);
      if (error instanceof ApiError && error.code === 'revision_conflict') onChanged();
    } finally {
      request.done();
    }
  }

  if (loadError) return <p className="auth-error" role="alert">{loadError}</p>;
  if (!doc) return <p className="doc-pending">{t('doc_loading')}</p>;
  const readable = doc.state === 'ok';
  return (
    <div className="doc-details">
      {readable ? (
        <form className="sec-form doc-edit" onSubmit={save}>
          <label className="sec-field">
            <span>{t('doc_title_label')}</span>
            <input className="set-input" type="text" maxLength={200} value={title} onChange={e => setTitle(e.target.value)} />
          </label>
          <label className="sec-field">
            <span>{t('doc_notes_label')}</span>
            <textarea className="set-input doc-notes" maxLength={4000} rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>
          {saveState.message && (
            <p className={saveState.phase === 'done' ? 'auth-success' : 'auth-error'} role={saveState.phase === 'done' ? 'status' : 'alert'}>{saveState.message}</p>
          )}
          <div className="doc-actions">
            <button className="set-btn-primary" type="submit" disabled={saveState.phase === 'pending'}>
              {saveState.phase === 'pending' ? t('auth_working') : t('doc_save')}
            </button>
          </div>
        </form>
      ) : (
        <p className="auth-error" role="alert">{t(doc.state === 'key_unavailable' ? 'doc_state_key' : 'doc_state_integrity')}</p>
      )}

      <div className="set-subhead mono">{t('doc_versions_head')}</div>
      <ol className="doc-versions">
        {(doc.versions || []).map(version => (
          <li key={version.id} className="doc-version">
            <div className="doc-version-main">
              <span className="doc-version-num mono">v{version.number}</span>
              <span className="doc-version-name">{version.filename || t('doc_name_unavailable')}</span>
            </div>
            <span className="doc-version-meta mono">
              {typeLabel(version.content_type)} · {fmt.size(version.size_bytes, t)} · {fmt.date(version.created_at)}
            </span>
            <button type="button" className="set-btn-ghost" disabled={version.state !== 'ok'}
                    onClick={() => download(version.number)}
                    aria-label={t('doc_download_version', version.number)}>
              {t('doc_download')}
            </button>
          </li>
        ))}
      </ol>
      {downloadError && <p className="auth-error" role="alert">{downloadError}</p>}

      <VersionUpload t={t} doc={doc} status={status} onChanged={() => { load(); onChanged(); }} />

      <div className="doc-delete">
        {!confirmDelete ? (
          <button type="button" className="set-btn-ghost doc-delete-btn" onClick={() => setConfirmDelete(true)}>
            {t('doc_delete')}
          </button>
        ) : (
          <div className="set-clear-confirm" role="group" aria-label={t('doc_delete')}>
            <p className="doc-delete-warning">{t('doc_delete_confirm', doc.version_count)}</p>
            <div className="doc-actions">
              <button type="button" className="set-btn-danger" disabled={deleteState.busy} onClick={remove}>
                {deleteState.busy ? t('auth_working') : t('doc_delete_yes')}
              </button>
              <button type="button" className="set-btn-ghost" disabled={deleteState.busy} onClick={() => setConfirmDelete(false)}>
                {t('doc_cancel')}
              </button>
            </div>
          </div>
        )}
        {deleteState.message && <p className="auth-error" role="alert">{deleteState.message}</p>}
      </div>
    </div>
  );
}

export function DocumentItem({ t, doc, status, expanded, onToggle, onChanged, onDeleted }) {
  const fmt = useFormatters();
  const scope = useAbortScope();
  const [error, setError] = React.useState('');
  const current = doc.current_version;
  const readable = doc.state === 'ok';
  async function downloadCurrent() {
    setError('');
    const request = scope();
    try {
      const { blob, filename } = await downloadDocument(doc.id, null, request.signal);
      if (request.aborted) return;
      saveBlob(blob, filename);
    } catch (failure) {
      if (request.aborted || failure?.name === 'AbortError') return;
      setError(errorText(failure, t, Math.round(status.max_bytes / 1048576)));
    } finally {
      request.done();
    }
  }
  return (
    <li className={'doc-item' + (readable ? '' : ' is-unreadable')}>
      <div className="doc-item-row">
        <div className="doc-item-main">
          <div className="doc-item-title">{readable ? doc.title : t('doc_title_unavailable')}</div>
          <div className="doc-item-meta mono">
            {current ? `${typeLabel(current.content_type)} · ${fmt.size(current.size_bytes, t)} · ` : ''}
            {t('doc_version_n', doc.current_version?.number ?? doc.version_count)}
            {doc.version_count > 1 ? ` · ${doc.version_count} ${t.pl('pl_doc_versions', doc.version_count)}` : ''}
            {' · '}{fmt.date(doc.updated_at)}
          </div>
          {!readable && (
            <div className="doc-item-state" role="note">
              {t(doc.state === 'key_unavailable' ? 'doc_state_key' : 'doc_state_integrity')}
            </div>
          )}
          {readable && doc.notes ? <div className="doc-item-notes">{doc.notes}</div> : null}
        </div>
        <div className="doc-item-actions">
          <button type="button" className="set-btn-ghost" onClick={downloadCurrent} disabled={!readable}>
            {t('doc_download')}
          </button>
          <button type="button" className="set-btn-ghost" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? t('doc_hide') : t('doc_details')}
          </button>
        </div>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {expanded && (
        <DocumentDetails t={t} summary={doc} status={status} onChanged={onChanged} onDeleted={onDeleted} />
      )}
    </li>
  );
}

export function FinanceDocuments() {
  const { t } = React.useContext(LifeLocaleContext);
  const fmt = useFormatters();
  const scope = useAbortScope();
  const [status, setStatus] = React.useState(null);
  const [phase, setPhase] = React.useState('loading'); // loading | ready | disabled | error
  const [error, setError] = React.useState('');
  const [docs, setDocs] = React.useState([]);
  const [expanded, setExpanded] = React.useState(null);
  const [notice, setNotice] = React.useState('');

  const refresh = React.useCallback(async () => {
    const request = scope();
    try {
      const nextStatus = await getDocumentStatus(request.signal);
      if (request.aborted) return;
      setStatus(nextStatus);
      if (!nextStatus.enabled) { setPhase('disabled'); return; }
      const list = await listDocuments(request.signal);
      if (request.aborted) return;
      setDocs(list);
      setPhase('ready');
      setError('');
    } catch (failure) {
      if (request.aborted || failure?.name === 'AbortError') return;
      if (failure instanceof ApiError && failure.code === 'documents_unavailable') { setPhase('disabled'); return; }
      setError(errorText(failure, t, 15));
      setPhase(prev => (prev === 'ready' ? 'ready' : 'error'));
    } finally {
      request.done();
    }
  }, [scope, t]);

  React.useEffect(() => { refresh(); }, [refresh]);

  if (phase === 'loading') {
    return <section className="card panel doc-panel"><p className="doc-pending">{t('doc_loading')}</p></section>;
  }
  if (phase === 'disabled') {
    return (
      <section className="card panel doc-panel doc-unavailable">
        <div className="panel-head"><h3 className="panel-title">{t('doc_unavailable_title')}</h3></div>
        <p>{t('doc_unavailable_body')}</p>
      </section>
    );
  }
  if (phase === 'error') {
    return (
      <section className="card panel doc-panel">
        <p className="auth-error" role="alert">{error}</p>
        <button type="button" className="set-btn-ghost" onClick={() => { setPhase('loading'); refresh(); }}>{t('doc_retry')}</button>
      </section>
    );
  }
  return (
    <div className="doc-page">
      <section className="card panel doc-panel doc-intro">
        <p className="doc-intro-text">{t('doc_intro')}</p>
        <ProtectionNote t={t} />
        <div className="doc-usage mono">
          {t('doc_usage', `${docs.length} ${t.pl('pl_documents', docs.length)}`,
            fmt.size(status.used_bytes ?? 0, t), fmt.size(status.max_account_bytes, t))}
        </div>
      </section>

      <UploadPanel t={t} status={status} onUploaded={() => { setNotice(''); refresh(); }} />

      <section className="card panel doc-panel doc-list-card" aria-live="polite">
        <div className="panel-head">
          <h3 className="panel-title">{t('doc_list_title')}</h3>
          <div className="panel-head-right"><span className="mono panel-meta">{docs.length} · {t.pl('pl_documents', docs.length)}</span></div>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-success" role="status">{notice}</p>}
        {docs.length === 0 ? (
          <div className="empty-state">{t('doc_empty')}</div>
        ) : (
          <ul className="doc-list">
            {docs.map(doc => (
              <DocumentItem
                key={doc.id}
                t={t}
                doc={doc}
                status={status}
                expanded={expanded === doc.id}
                onToggle={() => setExpanded(current => (current === doc.id ? null : doc.id))}
                onChanged={refresh}
                onDeleted={() => { setExpanded(null); setNotice(t('doc_deleted')); refresh(); }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
