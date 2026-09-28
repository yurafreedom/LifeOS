import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsRepository } from '../repositories/analyticsRepository';

const FINGERPRINT = 'a'.repeat(64);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('AnalyticsRepository · the signal boundary', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('reads signals with an explicit bounded limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ signals: [], acknowledged: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await new AnalyticsRepository().readSignals({ limit: 3, timezone: 'Europe/Kyiv' });
    const [path] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/v1/aa/signals?limit=3&timezone=Europe%2FKyiv');
  });

  it('refuses a nonsensical limit before reaching the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const repository = new AnalyticsRepository();
    expect(() => repository.readSignals({ limit: -1 })).toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the observed fingerprint with an acknowledgement', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ resolution: 'acknowledged', replayed: false }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await new AnalyticsRepository().acknowledgeSignal('r:1:s:band=80', FINGERPRINT);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe('/api/v1/aa/signal-episodes/r%3A1%3As%3Aband%3D80/ack');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      resolution: 'acknowledged',
      input_fingerprint: FINGERPRINT,
    });
    // Same-origin credentials and a JSON content type, like every other AA write.
    expect(init.credentials).toBe('same-origin');
    expect(init.headers.get('Content-Type')).toBe('application/json');
  });

  it('refuses to acknowledge without a real fingerprint', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const repository = new AnalyticsRepository();
    expect(() => repository.acknowledgeSignal('r:1:s:band=80', 'nope')).toThrow(TypeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
