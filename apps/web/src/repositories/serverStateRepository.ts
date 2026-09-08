import { ApiError } from '../api/client';
import { getState, replaceState } from '../api/state';
import type { LifeOsState, StateEnvelope, StateRepository } from './stateRepository';

function validateEnvelope(value: unknown): StateEnvelope {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Server state envelope is invalid.');
  }
  const envelope = value as Record<string, unknown>;
  const payload = envelope.payload;
  if (
    envelope.schema_version !== 2
    || !Number.isInteger(envelope.revision)
    || (envelope.revision as number) < 1
    || payload == null
    || typeof payload !== 'object'
    || Array.isArray(payload)
    || (payload as Record<string, unknown>).version !== 2
    || typeof envelope.created_at !== 'string'
    || typeof envelope.updated_at !== 'string'
  ) {
    throw new Error('Server state envelope is invalid.');
  }
  return value as StateEnvelope;
}

export class ServerStateRepository implements StateRepository {
  async load(signal?: AbortSignal): Promise<StateEnvelope | null> {
    try {
      return validateEnvelope(await getState(signal));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.code === 'state_not_initialized') {
        return null;
      }
      throw error;
    }
  }

  replace(payload: LifeOsState, expectedRevision: number): Promise<StateEnvelope> {
    return replaceState(payload, expectedRevision).then(validateEnvelope);
  }

  reset(payload: LifeOsState, expectedRevision: number): Promise<StateEnvelope> {
    return replaceState(payload, expectedRevision).then(validateEnvelope);
  }
}
