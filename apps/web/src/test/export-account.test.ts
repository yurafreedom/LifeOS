import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindAccount, resetAccountBindingForTests } from '../api/accountBinding';
import { exportAccount } from '../api/exportAccount';
import { ApiError, NetworkError } from '../api/client';

afterEach(() => {
  vi.unstubAllGlobals();
  resetAccountBindingForTests();
});

describe('binary server account export', () => {
  it('uses the authenticated same-origin endpoint without storing history locally', async () => {
    const blob = new Blob(['ZIP'], { type: 'application/zip' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(blob, {
      headers: { 'Content-Type': 'application/zip' },
    }));
    vi.stubGlobal('fetch', fetchMock);
    bindAccount('account-a');
    const result = await exportAccount();
    expect(await result.text()).toBe('ZIP');
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/v1/export');
    expect(init).toMatchObject({ credentials: 'same-origin', cache: 'no-store' });
    expect(init.headers.get('Accept')).toBe('application/zip');
    // Bound to the tab's account: the server refuses it if another account is signed in.
    expect(init.headers.get('X-LifeOS-Account')).toBe('account-a');
  });

  it('discards an export that completes after the account changed', async () => {
    let resolveFetch: (value: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveFetch = resolve; })));
    bindAccount('account-a');
    const pending = exportAccount();
    bindAccount('account-b');
    resolveFetch(new Response(new Blob(['A-ZIP']), { headers: { 'Content-Type': 'application/zip' } }));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError', reason: 'account_changed' });
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
    // The caller's signal is combined with the account generation's signal.
    const forwarded = fetchMock.mock.calls[0][1].signal as AbortSignal;
    expect(forwarded.aborted).toBe(false);
    controller.abort();
    expect(forwarded.aborted).toBe(true);
  });
});
