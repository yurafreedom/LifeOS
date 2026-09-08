import { requestJson } from './client';

export type SessionUser = {
  id: string;
  email: string;
  created_at: string;
};

export function getCurrentUser(signal?: AbortSignal): Promise<SessionUser> {
  return requestJson<SessionUser>('/api/v1/auth/me', { signal });
}

export function loginAccount(input: { email: string; password: string }): Promise<SessionUser> {
  return requestJson<SessionUser>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function bootstrapAccount(input: {
  email: string;
  password: string;
  bootstrapToken: string;
}): Promise<SessionUser> {
  return requestJson<SessionUser>('/api/v1/auth/bootstrap', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      bootstrap_token: input.bootstrapToken,
    }),
  });
}

export function logoutAccount(): Promise<void> {
  return requestJson<void>('/api/v1/auth/logout', { method: 'POST' });
}
