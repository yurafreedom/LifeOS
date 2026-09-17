import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportAccount } from '../api/exportAccount';
import { ApiError, NetworkError } from '../api/client';

afterEach(() => vi.unstubAllGlobals());

describe('binary server account export', () => {
  it('uses the authenticated same-origin endpoint without storing history locally', async () => {
    const blob = new Blob(['ZIP'], { type: 'application/zip' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(blob, {
      headers: { 'Content-Type': 'application/zip' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await exportAccount();
    expect(await result.text()).toBe('ZIP');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/export', {
      credentials: 'same-origin', cache: 'no-store', signal: undefined,
      headers: { Accept: 'application/zip' },
    });
  });

  it('preserves server error codes and authentication failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'auth_required', message: 'Sign in.',
    }), { status: 401 })));
    await expect(exportAccount()).rejects.toMatchObject({
      status: 401, code: 'auth_required', message: 'Sign in.',
    });
  });

  it('handles a non-JSON error without downloading it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('gateway failure', { status: 502 })));
    await expect(exportAccount()).rejects.toMatchObject({ status: 502, code: 'http_502' });
  });

  it('rejects an HTML login redirect instead of saving it as a ZIP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html/>', {
      headers: { 'Content-Type': 'text/html' },
    })));
    await expect(exportAccount()).rejects.toBeInstanceOf(ApiError);
  });

  it('normalizes network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(exportAccount()).rejects.toBeInstanceOf(NetworkError);
  });

  it('preserves aborts and forwards the signal', async () => {
    const aborted = new DOMException('cancelled', 'AbortError');
    const fetchMock = vi.fn().mockRejectedValue(aborted);
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    await expect(exportAccount(controller.signal)).rejects.toBe(aborted);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
