import { ApiError, apiFetch, failureFrom } from './client';
import { assertCurrent } from './accountBinding';

/** Binary export is separate from snapshot JSON and never enters localStorage.
 *  Account-bound like every request: an export that settles after the tab's
 *  account changed is discarded (AccountChangedError), never offered as a file. */
export async function exportAccount(signal?: AbortSignal): Promise<Blob> {
  const { response, ticket } = await apiFetch('/api/v1/export', {
    signal,
    headers: { Accept: 'application/zip' },
  });
  if (!response.ok) throw await failureFrom(response, ticket, 'Account export failed.');
  if (!response.headers.get('Content-Type')?.startsWith('application/zip')) {
    throw new ApiError(response.status, 'invalid_export', 'Expected a ZIP account export.');
  }
  const blob = await response.blob();
  assertCurrent(ticket);
  return blob;
}
