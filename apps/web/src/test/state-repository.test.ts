import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerStateRepository } from '../repositories/serverStateRepository';
import type { LifeOsState } from '../repositories/stateRepository';

const payload = { version: 2 } as LifeOsState;
const envelope = {
  schema_version: 2 as const,
  revision: 3,
  payload,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('ServerStateRepository', () => {
  it('maps only typed missing state to null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 'state_not_initialized', message: 'missing' }), { status: 404 },
    )));
    await expect(new ServerStateRepository().load()).resolves.toBeNull();
  });

  it('does not hide unrelated 404 failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ code: 'route_missing', message: 'missing' }), { status: 404 },
    )));
    await expect(new ServerStateRepository().load()).rejects.toMatchObject({ code: 'route_missing' });
  });

  it('loads an envelope unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(envelope))));
    await expect(new ServerStateRepository().load()).resolves.toEqual(envelope);
  });

  it('rejects a malformed server envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...envelope, revision: 0 }))));
    await expect(new ServerStateRepository().load()).rejects.toThrow(/envelope/i);
  });

  it('replaces and resets with expected revision and schema version', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify(envelope))));
    vi.stubGlobal('fetch', fetchMock);
    const repository = new ServerStateRepository();
    await repository.replace(payload, 2);
    await repository.reset(payload, 3);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      expected_revision: 2, schema_version: 2, payload,
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).expected_revision).toBe(3);
  });
});
