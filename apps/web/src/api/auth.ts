import { requestJson } from './client';

export type SessionUser = {
  id: string;
  email: string;
  created_at: string;
  role: 'owner' | 'member';
  email_verified_at: string | null;
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

/* ── anonymous recovery / verification / invitation flows (JENKIN S1) ── */

export function requestPasswordReset(email: string): Promise<{ status: 'accepted' }> {
  return requestJson('/api/v1/auth/password-reset/request', {
    method: 'POST', body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  return requestJson('/api/v1/auth/password-reset/confirm', {
    method: 'POST', body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export function confirmEmailVerification(token: string): Promise<void> {
  return requestJson('/api/v1/auth/email-verification/confirm', {
    method: 'POST', body: JSON.stringify({ token }),
  });
}

export type InvitationPreview = { email: string; expires_at: string };

export function inspectInvitation(token: string): Promise<InvitationPreview> {
  return requestJson('/api/v1/auth/invitations/inspect', {
    method: 'POST', body: JSON.stringify({ token }),
  });
}

export function acceptInvitation(input: { token: string; email: string; password: string }): Promise<SessionUser> {
  return requestJson('/api/v1/auth/invitations/accept', {
    method: 'POST', body: JSON.stringify(input),
  });
}
