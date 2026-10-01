# JENKIN — mail (SMTP) and reverse-proxy configuration

Date: 2026-10-01 (Europe/Kyiv). Applies to the S1 account flows (recovery, verification, invitations) and to the
client network used by throttling and the security audit. **SMTP is not a prerequisite for S2 documents.** No real
credentials are recorded anywhere in the repository; the owner's ignored `apps/api/.env` was not edited.

## 1. Mail

All variables carry the `LIFEOS_` prefix (settings: `apps/api/app/config.py`).

| Variable | Example placeholder | Notes |
|---|---|---|
| `LIFEOS_MAIL_BACKEND` | `smtp` | `disabled` (default: flows say mail is unavailable; invitations show a one-time manual link), `memory` (tests only), `file` (development: `.eml` files in `LIFEOS_MAIL_FILE_DIR`), `smtp` (production). Production refuses `memory`/`file`. |
| `LIFEOS_SMTP_HOST` | `smtp.example.net` | Provider's submission host. |
| `LIFEOS_SMTP_PORT` | `587` | `587` with `starttls`, `465` with `ssl`. |
| `LIFEOS_SMTP_SECURITY` | `starttls` | `starttls` or `ssl`; `none` is refused in production. |
| `LIFEOS_SMTP_USERNAME` | `jenkin-mailer` | |
| `LIFEOS_SMTP_PASSWORD` | `<secret — from the secret store>` | Secret. |
| `LIFEOS_MAIL_FROM` | `JENKIN <no-reply@your-domain>` | Must be a sender the provider allows, with SPF/DKIM (and ideally DMARC) for its domain. |
| `LIFEOS_PUBLIC_APP_URL` | `https://jenkin.your-domain` | Base of links in mail; must be https in production. |
| `LIFEOS_SMTP_TIMEOUT_SECONDS` | `10` | Optional. |

Where production secrets belong: the deployment's secret store or secret-mounted environment (systemd
`EnvironmentFile=` with `0600` owned by root, Docker/Kubernetes secrets, the hosting provider's secret settings) —
never the repository, never `.env.example`, never a report. For local development use
`LIFEOS_MAIL_BACKEND=file` and `LIFEOS_MAIL_FILE_DIR=/some/ignored/dir` (no network mail is sent).

Verification after configuring: request a password reset for your own address and confirm delivery; check the
security events list shows `password_reset_requested` and no `delivery failed`; send a verification mail from
Settings → Security.

## 2. Reverse proxy and client address

Throttling (per network) and the audit's coarse network use `app/security/client_info.py::client_address`:
with `LIFEOS_TRUSTED_PROXY_HOPS=0` (default) it uses the socket peer; with `N > 0` it takes the N-th entry from the
**right** of `X-Forwarded-For` (each trusted proxy appends the address it received the request from).

**The ASGI server has its own forwarded-header handling.** uvicorn (0.51, pinned) enables `--proxy-headers` by
default and trusts `X-Forwarded-For`/`X-Forwarded-Proto` from peers listed in `--forwarded-allow-ips` (default
`127.0.0.1`, or the `FORWARDED_ALLOW_IPS` environment variable). When it trusts the peer it **rewrites the
request's client address** (and scheme) before JENKIN sees it. Two interpreters of one header invite double
interpretation or spoofing. Choose exactly one:

| Topology | uvicorn | `LIFEOS_TRUSTED_PROXY_HOPS` |
|---|---|---|
| No proxy (development, direct) | default | `0` |
| One proxy on the same host (nginx/Caddy → `127.0.0.1:8000`), recommended | `--proxy-headers --forwarded-allow-ips=127.0.0.1` (default) | `0` — uvicorn already resolved the client from the proxy's header |
| Same, but you prefer the app to decide | `--no-proxy-headers` | `1` |
| CDN → proxy → uvicorn | `--no-proxy-headers` | `2` (only if both layers append to `X-Forwarded-For`) |

Never use `--forwarded-allow-ips='*'`: uvicorn then trusts headers from anyone and takes the left-most entry,
which the client controls. Never set `LIFEOS_TRUSTED_PROXY_HOPS` larger than the number of proxies that really
append to the header: a client could then choose its own throttling address. The proxy must **overwrite or append**
`X-Forwarded-For` (nginx `proxy_add_x_forwarded_for` appends; that is what the hop count assumes) and should set
`X-Forwarded-Proto https`.

Keep network throttling enabled regardless; per-address and per-account limits are independent of the proxy, but
the per-network limits depend on a correct client address. Everyone behind one NAT shares the network limits
(S1 report §7.5).

Also required in production (S1): `LIFEOS_ENVIRONMENT=production`, `LIFEOS_COOKIE_SECURE=true`,
`LIFEOS_ALLOWED_HOSTS` (the public host name(s)), `LIFEOS_ALLOWED_ORIGINS` (`https://…` of the web app).

Verification: from an external network, fail a login three times and check Settings → Security → recent events: the
network shown must be *your* /24 (or /48), not the proxy's address. Then send a request with a forged
`X-Forwarded-For: 203.0.113.9` and confirm the recorded network does not change to `203.0.113.0/24`.
