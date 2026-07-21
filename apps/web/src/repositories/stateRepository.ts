export type LifeOsState = Record<string, unknown> & { version: 2 };

export type StateEnvelope = {
  schema_version: 2;
  revision: number;
  payload: LifeOsState;
  created_at: string;
  updated_at: string;
};

export interface StateRepository {
  load(signal?: AbortSignal): Promise<StateEnvelope | null>;
  replace(payload: LifeOsState, expectedRevision: number): Promise<StateEnvelope>;
  reset(payload: LifeOsState, expectedRevision: number): Promise<StateEnvelope>;
}
