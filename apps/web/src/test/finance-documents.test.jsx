/* JENKIN S2 · checkpoint 3: the Finance → Documents client. Requests are
   account-bound raw uploads; nothing descriptive travels in the URL; late
   answers after an account change are discarded; the copy is precise about
   what encryption covers. */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountChangedError, bindAccount, resetAccountBindingForTests } from '../api/accountBinding';
import {
  deleteDocument,
  downloadDocument,
  encodeMetaHeader,
  filenameFromDisposition,
  newIdempotencyKey,
  updateDocument,
  uploadDocument,
  uploadVersion,
} from '../api/documents';
import { normalizeRoute, readRouteFromHash } from '../app/routeRegistry.js';
import { LifeLocaleContext, LifeMakeT, LifeStrings } from '../context/LocaleContext.jsx';
import {
  DocumentItem,
  FinanceDocuments,
  ProtectionNote,
  UploadPanel,
} from '../pages/finances/FinanceDocuments.jsx';

afterEach(() => {
  vi.unstubAllGlobals();
  resetAccountBindingForTests();
});

function decodeMeta(header) {
  const padded = header.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (header.length % 4)) % 4);
  const binary = globalThis.atob(padded);
  return JSON.parse(new globalThis.TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
}

function stubFetch(responder) {
  const fetchMock = vi.fn(responder);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const RECORD = {
  id: 'd1', revision: 1, title: 'Договор', notes: '', state: 'ok',
  created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z',
  current_version: { id: 'v1', number: 1, content_type: 'application/pdf', size_bytes: 2048,
    created_at: '2026-10-01T10:00:00Z', filename: 'договор.pdf', state: 'ok' },
  version_count: 1, total_bytes: 2048, versions: null,
};

function json(body, status = 200) {
  return new globalThis.Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('documents API client', () => {
  it('uploads the raw file, bound to the tab account, with metadata only in a header', async () => {
    const fetchMock = stubFetch(async () => json(RECORD, 201));
    bindAccount('account-a');
    const file = new globalThis.File([new Uint8Array([37, 80, 68, 70])], 'Кредитний договір.pdf', { type: 'application/pdf' });
    const result = await uploadDocument(file, { title: ' Договір ', notes: 'нотатка' }, 'doc-key-0123456789abcdef');
    expect(result.created).toBe(true);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/v1/documents');
    expect(path).not.toContain('Кредит');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(file);
    const headers = new globalThis.Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/octet-stream');
    expect(headers.get('X-LifeOS-Account')).toBe('account-a');
    expect(headers.get('Idempotency-Key')).toBe('doc-key-0123456789abcdef');
    expect(decodeMeta(headers.get('X-LifeOS-Document-Meta'))).toEqual({
      filename: 'Кредитний договір.pdf', title: 'Договір', notes: 'нотатка', declared_type: 'application/pdf',
    });
    expect(init.credentials).toBe('same-origin');
    expect(init.cache).toBe('no-store');
  });

  it('a new version names the revision it was based on; retries keep the key', async () => {
    const fetchMock = stubFetch(async () => json(RECORD, 200));
    bindAccount('account-a');
    const file = new globalThis.File([new Uint8Array([1])], 'v2.png', { type: 'image/png' });
    const { created } = await uploadVersion('d1', file, 3, 'doc-key-retry-0000000001');
    expect(created).toBe(false); // a replayed retry, not a duplicate
    const headers = new globalThis.Headers(fetchMock.mock.calls[0][1].headers);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/documents/d1/versions');
    expect(headers.get('X-LifeOS-Expected-Revision')).toBe('3');
    expect(headers.get('Idempotency-Key')).toBe('doc-key-retry-0000000001');
  });

  it('edits and deletes carry the expected revision as JSON', async () => {
    const fetchMock = stubFetch(async (_path, init) => (init.method === 'DELETE' ? new globalThis.Response(null, { status: 204 }) : json(RECORD)));
    bindAccount('account-a');
    await updateDocument('d1', { expected_revision: 2, title: 'Новое' });
    await deleteDocument('d1', 3);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ expected_revision: 2, title: 'Новое' });
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ expected_revision: 3 });
  });

  it('downloads are re-typed as octet-stream and named from Content-Disposition', async () => {
    stubFetch(async () => new globalThis.Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': "attachment; filename=\"_____.pdf\"; filename*=UTF-8''%D0%94%D0%BE%D0%B3.pdf",
      },
    }));
    bindAccount('account-a');
    const { blob, filename } = await downloadDocument('d1', 2);
    expect(blob.type).toBe('application/octet-stream');
    expect(filename).toBe('Дог.pdf');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('a download that settles after the account changed is discarded', async () => {
    let release;
    stubFetch(() => new Promise((resolve) => { release = resolve; }));
    bindAccount('account-a');
    const pending = downloadDocument('d1', null);
    bindAccount('account-b');
    release(new globalThis.Response(new Uint8Array([9]), { status: 200 }));
    await expect(pending).rejects.toBeInstanceOf(AccountChangedError);
  });

  it('server refusals surface their stable codes', async () => {
    stubFetch(async () => json({ code: 'encrypted_pdf', message: 'x' }, 422));
    bindAccount('account-a');
    const file = new globalThis.File([new Uint8Array([1])], 'locked.pdf');
    await expect(uploadDocument(file, {}, 'doc-key-0123456789abcdef')).rejects.toMatchObject({ code: 'encrypted_pdf', status: 422 });
  });

  it('helpers: header encoding, filenames and idempotency keys', () => {
    expect(decodeMeta(encodeMetaHeader({ filename: 'Ї ґ є.pdf', title: undefined }))).toEqual({ filename: 'Ї ґ є.pdf' });
    expect(encodeMetaHeader({ filename: '?>?>' })).not.toMatch(/[+/=]/);
    expect(filenameFromDisposition('attachment; filename="a.png"', 'x')).toBe('a.png');
    expect(filenameFromDisposition(null, 'fallback')).toBe('fallback');
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
    expect(newIdempotencyKey()).not.toBe(key);
  });
});

describe('Finance → Documents route', () => {
  it('is a deep-linkable tab of the Finances surface', () => {
    expect(readRouteFromHash('#/finances/documents')).toBe('finances');
    expect(normalizeRoute('finances/documents')).toEqual({ route: 'finances', hash: '#/finances/documents' });
    expect(readRouteFromHash('#/finances/other')).toBe('home');
  });
});

function render(node, locale = 'ru') {
  const t = LifeMakeT(locale);
  return renderToStaticMarkup(
    <LifeLocaleContext.Provider value={{ locale, t }}>{node(t)}</LifeLocaleContext.Provider>,
  );
}

const STATUS = {
  enabled: true, accepted_types: [], max_bytes: 15 * 1048576, max_documents: 1000,
  max_account_bytes: 512 * 1048576, document_count: 0, used_bytes: 0, protection: 'server_side_at_rest',
};

describe('Documents UI', () => {
  it('starts in an honest loading state', () => {
    expect(render(() => <FinanceDocuments />)).toContain(LifeStrings.ru.doc_loading);
  });

  it('upload panel states the format and size limits and needs a file', () => {
    for (const locale of ['ru', 'uk']) {
      const html = render((t) => <UploadPanel t={t} status={STATUS} onUploaded={() => {}} />, locale);
      expect(html).toContain(LifeStrings[locale].doc_upload_guidance.replace('{0}', '15'));
      expect(html).toContain('accept=".pdf,.jpg,.jpeg,.png');
      expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
    }
  });

  it('lists a document with type, size and version, and never shows an unreadable title', () => {
    const ok = render((t) => <DocumentItem t={t} doc={RECORD} status={STATUS} expanded={false} onToggle={() => {}} onChanged={() => {}} onDeleted={() => {}} />);
    expect(ok).toContain('Договор');
    expect(ok).toContain('PDF · 2 КБ');
    const locked = render((t) => <DocumentItem t={t} doc={{ ...RECORD, state: 'key_unavailable', title: null }} status={STATUS} expanded={false} onToggle={() => {}} onChanged={() => {}} onDeleted={() => {}} />);
    expect(locked).toContain(LifeStrings.ru.doc_state_key);
    expect(locked).toContain(LifeStrings.ru.doc_title_unavailable);
    expect(locked).toMatch(/<button[^>]*disabled[^>]*>скачать/);
  });

  it('describes the protection scope precisely and makes no blanket claim', () => {
    for (const locale of ['ru', 'uk']) {
      const html = render((t) => <ProtectionNote t={t} />, locale);
      const strings = LifeStrings[locale];
      expect(html).toContain(strings.doc_protection_server);
      expect(html).toContain(strings.doc_protection_backups);
      expect(html).toContain(strings.doc_protection_scan);
    }
    const all = JSON.stringify([LifeStrings.ru, LifeStrings.uk]).toLowerCase();
    for (const claim of ['все данные зашифрованы', 'усі дані зашифровані', 'всі дані зашифровані', 'end-to-end', 'сквозное шифрование включено']) {
      expect(all).not.toContain(claim);
    }
    expect(LifeStrings.ru.doc_protection_server).toContain('не сквозное');
    expect(LifeStrings.uk.doc_protection_server).toContain('не наскрізне');
  });

  it('every documents string exists in both locales', () => {
    const keys = Object.keys(LifeStrings.ru).filter((key) => key.startsWith('doc_') || key.startsWith('set_export_documents') || key.startsWith('fin_tab'));
    expect(keys.length).toBeGreaterThan(60);
    for (const key of keys) expect(LifeStrings.uk[key], key).toBeTruthy();
  });
});
