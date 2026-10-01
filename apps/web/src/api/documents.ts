import { assertCurrent } from './accountBinding';
import { ApiError, apiFetch, failureFrom, requestJson } from './client';

/**
 * Encrypted documents (JENKIN S2). Every call is account-bound like any other
 * request: a response that settles after the tab's account changed is
 * discarded (`AccountChangedError`), never shown or offered as a file.
 *
 * Uploads send the raw file as `application/octet-stream` (the server never
 * parses multipart, so nothing is spooled to its disk); descriptive fields go
 * in a base64url JSON header, never in the URL.
 */

export type DocumentRecordState = 'ok' | 'key_unavailable' | 'integrity_failed';

export type DocumentVersion = {
  id: string;
  number: number;
  content_type: string;
  size_bytes: number;
  created_at: string;
  filename: string | null;
  state: DocumentRecordState;
};

export type DocumentRecord = {
  id: string;
  revision: number;
  title: string | null;
  notes: string | null;
  state: DocumentRecordState;
  created_at: string;
  updated_at: string;
  current_version: DocumentVersion | null;
  version_count: number;
  total_bytes: number;
  versions: DocumentVersion[] | null;
};

export type DocumentStatus = {
  enabled: boolean;
  accepted_types: string[];
  max_bytes: number;
  max_documents: number;
  max_account_bytes: number;
  document_count: number | null;
  used_bytes: number | null;
  protection: 'server_side_at_rest';
};

export const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

export function newIdempotencyKey(): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return `doc-${random}`;
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return `doc-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export function encodeMetaHeader(meta: Record<string, string | undefined>): string {
  const json = JSON.stringify(Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined)));
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function getDocumentStatus(signal?: AbortSignal): Promise<DocumentStatus> {
  return requestJson<DocumentStatus>('/api/v1/documents/status', { signal });
}

export async function listDocuments(signal?: AbortSignal): Promise<DocumentRecord[]> {
  const body = await requestJson<{ documents: DocumentRecord[] }>('/api/v1/documents', { signal });
  return body.documents;
}

export function getDocument(id: string, signal?: AbortSignal): Promise<DocumentRecord> {
  return requestJson<DocumentRecord>(`/api/v1/documents/${encodeURIComponent(id)}`, { signal });
}

async function sendFile(
  path: string,
  file: Blob,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ record: DocumentRecord; created: boolean }> {
  const { response, ticket } = await apiFetch(path, {
    method: 'POST',
    body: file,
    signal,
    headers: { 'Content-Type': 'application/octet-stream', Accept: 'application/json', ...headers },
  });
  if (!response.ok) throw await failureFrom(response, ticket);
  const record = (await response.json()) as DocumentRecord;
  assertCurrent(ticket);
  return { record, created: response.status === 201 };
}

export function uploadDocument(
  file: File,
  fields: { title?: string; notes?: string },
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return sendFile('/api/v1/documents', file, {
    'X-LifeOS-Document-Meta': encodeMetaHeader({
      filename: file.name,
      title: fields.title?.trim() || undefined,
      notes: fields.notes?.trim() || undefined,
      declared_type: file.type || undefined,
    }),
    'Idempotency-Key': idempotencyKey,
  }, signal);
}

export function uploadVersion(
  id: string,
  file: File,
  expectedRevision: number,
  idempotencyKey: string,
  signal?: AbortSignal,
) {
  return sendFile(`/api/v1/documents/${encodeURIComponent(id)}/versions`, file, {
    'X-LifeOS-Document-Meta': encodeMetaHeader({ filename: file.name, declared_type: file.type || undefined }),
    'Idempotency-Key': idempotencyKey,
    'X-LifeOS-Expected-Revision': String(expectedRevision),
  }, signal);
}

export function updateDocument(
  id: string,
  body: { expected_revision: number; title?: string; notes?: string },
  signal?: AbortSignal,
): Promise<DocumentRecord> {
  return requestJson<DocumentRecord>(`/api/v1/documents/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    signal,
  });
}

export function deleteDocument(id: string, expectedRevision: number, signal?: AbortSignal): Promise<void> {
  return requestJson<void>(`/api/v1/documents/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ expected_revision: expectedRevision }),
    signal,
  });
}

/** RFC 6266 filename* (UTF-8) first, then the ASCII fallback. */
export function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const extended = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (extended) {
    try { return decodeURIComponent(extended[1]); } catch { /* fall through */ }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : fallback;
}

/** The server authenticates the whole file before sending a byte; the blob is
 *  re-typed as octet-stream so it can only be saved, never rendered in-app. */
export async function downloadDocument(
  id: string,
  versionNumber: number | null,
  signal?: AbortSignal,
): Promise<{ blob: Blob; filename: string }> {
  const path = versionNumber == null
    ? `/api/v1/documents/${encodeURIComponent(id)}/content`
    : `/api/v1/documents/${encodeURIComponent(id)}/versions/${versionNumber}/content`;
  const { response, ticket } = await apiFetch(path, { signal });
  if (!response.ok) throw await failureFrom(response, ticket);
  const data = await response.blob();
  assertCurrent(ticket);
  return {
    blob: new Blob([data], { type: 'application/octet-stream' }),
    filename: filenameFromDisposition(response.headers.get('Content-Disposition'), 'document'),
  };
}

export async function exportDocuments(signal?: AbortSignal): Promise<Blob> {
  const { response, ticket } = await apiFetch('/api/v1/export/documents', {
    signal,
    headers: { Accept: 'application/zip' },
  });
  if (!response.ok) throw await failureFrom(response, ticket, 'Document export failed.');
  if (!response.headers.get('Content-Type')?.startsWith('application/zip')) {
    throw new ApiError(response.status, 'invalid_export', 'Expected a ZIP documents export.');
  }
  const blob = await response.blob();
  assertCurrent(ticket);
  return new Blob([blob], { type: 'application/zip' });
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
