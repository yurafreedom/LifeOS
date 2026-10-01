/* Account security for the signed-in, account-bound user (JENKIN S1).
   Every call goes through the bound client: the server refuses it if another
   account now owns the session cookie. */

import { requestJson } from './client';

export type AccountSession = {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  device: string | null;
  current: boolean;
};

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
/** `pending`: committed, delivery not confirmed (never treated as sent). */
export type InvitationDelivery = 'pending' | 'sent' | 'manual' | 'failed';

export type Invitation = {
  id: string;
  email: string;
  created_at: string;
  expires_at: string;
  status: InvitationStatus;
  delivery: InvitationDelivery;
};

export type CreatedInvitation = Invitation & { invite_url: string | null };

export type SecurityEvent = {
  event: string;
  occurred_at: string;
  device_label: string | null;
  network: string | null;
};

const JSON_POST = (body: unknown = {}) => ({ method: 'POST', body: JSON.stringify(body) });

export function changePassword(currentPassword: string, newPassword: string): Promise<{ status: 'changed'; revoked_sessions: number }> {
  return requestJson('/api/v1/account/password', JSON_POST({
    current_password: currentPassword, new_password: newPassword,
  }));
}

export function sendEmailVerification(): Promise<{ status: 'sent' }> {
  return requestJson('/api/v1/account/email-verification', JSON_POST());
}

export async function listSessions(signal?: AbortSignal): Promise<AccountSession[]> {
  const body = await requestJson<{ sessions: AccountSession[] }>('/api/v1/account/sessions', { signal });
  return body.sessions;
}

export function revokeSession(sessionId: string): Promise<void> {
  return requestJson(`/api/v1/account/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

export function revokeOtherSessions(): Promise<{ revoked_sessions: number }> {
  return requestJson('/api/v1/account/sessions/revoke-others', JSON_POST());
}

export async function listInvitations(signal?: AbortSignal): Promise<Invitation[]> {
  const body = await requestJson<{ invitations: Invitation[] }>('/api/v1/account/invitations', { signal });
  return body.invitations;
}

export function createInvitation(email: string): Promise<CreatedInvitation> {
  return requestJson('/api/v1/account/invitations', JSON_POST({ email }));
}

export function revokeInvitation(invitationId: string): Promise<void> {
  return requestJson(`/api/v1/account/invitations/${encodeURIComponent(invitationId)}`, { method: 'DELETE' });
}

export async function listSecurityEvents(signal?: AbortSignal): Promise<SecurityEvent[]> {
  const body = await requestJson<{ events: SecurityEvent[] }>('/api/v1/account/security-events', { signal });
  return body.events;
}
