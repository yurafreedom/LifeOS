import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkError, requestJson } from '../api/client';
import { bootstrapAccount, getCurrentUser, loginAccount, logoutAccount } from '../api/auth';

afterEach(() => vi.unstubAllGlobals());

describe('API client', () => {
  it('uses same-origin credentials and JSON headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await requestJson('/api/v1/example', { method: 'POST', body: '{}' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/example', expect.objectContaining({ credentials: 'same-origin' }));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('supports empty 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(requestJson('/api/v1/empty')).resolves.toBeUndefined();
  });

  it('maps stable and validation HTTP failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 'revision_conflict', message: 'Conflict', current_revision: 4 }),
      { status: 409 },
    )));
    await expect(requestJson('/api/v1/state')).rejects.toMatchObject({
      status: 409,
      code: 'revision_conflict',
    });
  });

  it('maps fetch failures separately from HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(requestJson('/api/v1/state')).rejects.toBeInstanceOf(NetworkError);
  });

  it('rejects cross-origin paths before fetch', async () => {
    await expect(requestJson('https://example.test/api')).rejects.toBeInstanceOf(TypeError);
  });

  it('sends the exact authentication request shapes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1', email: 'a@b.co', created_at: 'now' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1', email: 'a@b.co', created_at: 'now' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'u1', email: 'a@b.co', created_at: 'now' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await getCurrentUser();
    await loginAccount({ email: 'a@b.co', password: 'secret' });
    await bootstrapAccount({ email: 'a@b.co', password: 'long-password', bootstrapToken: 'token' });
    await logoutAccount();
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      '/api/v1/auth/me', '/api/v1/auth/login', '/api/v1/auth/bootstrap', '/api/v1/auth/logout',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[2][1].body as string)).toEqual({
      email: 'a@b.co', password: 'long-password', bootstrap_token: 'token',
    });
  });
});
