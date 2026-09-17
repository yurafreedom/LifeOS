import { ApiError, NetworkError } from './client';

/** Binary export is separate from snapshot JSON and never enters localStorage. */
export async function exportAccount(signal?: AbortSignal): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch('/api/v1/export', {
      credentials: 'same-origin', cache: 'no-store', signal,
      headers: { Accept: 'application/zip' },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new NetworkError(error);
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const record = body !== null && typeof body === 'object' ? body as Record<string, unknown> : null;
    throw new ApiError(response.status,
      typeof record?.code === 'string' ? record.code : `http_${response.status}`,
      typeof record?.message === 'string' ? record.message : 'Account export failed.', body);
  }
  if (!response.headers.get('Content-Type')?.startsWith('application/zip')) {
    throw new ApiError(response.status, 'invalid_export', 'Expected a ZIP account export.');
  }
  return response.blob();
}
