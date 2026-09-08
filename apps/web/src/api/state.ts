import { requestJson } from './client';
import type { LifeOsState, StateEnvelope } from '../repositories/stateRepository';

export function getState(signal?: AbortSignal): Promise<StateEnvelope> {
  return requestJson<StateEnvelope>('/api/v1/state', { signal });
}

export function replaceState(
  payload: LifeOsState,
  expectedRevision: number,
): Promise<StateEnvelope> {
  return requestJson<StateEnvelope>('/api/v1/state', {
    method: 'PUT',
    body: JSON.stringify({
      expected_revision: expectedRevision,
      schema_version: 2,
      payload,
    }),
  });
}
