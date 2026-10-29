 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 VAPT-001: analysis, impact and remediation plan

 Context

 docs/VAPT-001.docx is a black-box OWASP WSTG test of the deployed app at https://coe.cuetrans.com:4000. It used an ADMIN account and thedeployment was running AUTH_TYPE=password. It reports 15 findings: 2 High, 6 Medium, 4 Low, 3 Info, plus one testing incident: a DELETE /users/{id} call hard-deleted hari.g, and the testers re-created the account with a new UUID.

 Most important point: the tested build is older than HEAD. The last commit (c66a507, Entra ID integration) changes the picture:
 - The OneLogin route from VAPT-15 no longer exists in the code. A grep for onelogin finds nothing.
 - With AUTH_TYPE=entra, /auth/login returns 403 (backend/app/api/v1/endpoints/auth.py:84). That removes the password attack surface behindVAPT-01, 07 and 08. MFA (VAPT-13) is then handled by Entra Conditional Access, not by the app.
 - Switching production to Entra is the single largest risk reducer. The plan treats it as step 0.

 The passed checks are a real strength: no SQLi, no XSS, no CORS reflection, JWT tampering rejected, API returns 401 without a session, and/docs and /openapi.json are closed.

 Finding-by-finding: what the code shows, impact, fix

 ID: 01 No rate limit / lockout
 Risk: High
 Still valid at HEAD?: Yes in password mode. Moot under Entra
 Root cause in code: auth.py:82 login() has no throttling. No limiter in requirements
 Impact if left: Unlimited online guessing, about 1,500 attempts/hour per connection
 Fix (effort): Step 0 (Entra). Also add a per-IP + per-identifier limiter on /auth/login, e.g. 5 per 15 min then 429, plus limit_req at nginx
 (S)
 ────────────────────────────────────────
 ID: 02 Logout doesn't revoke JWT
 Risk: High
 Still valid at HEAD?: Yes, in every auth mode
 Root cause in code: auth.py:206 only deletes the cookie. core/session.py JWT has no jti or version claim. deps.py:33 get_current_user checks
 only the signature and is_active
 Impact if left: A stolen or copied cookie works for up to 8 h after logout
 Fix (effort): Add a session_version int column on users, put it in the JWT as ver, compare it in get_current_user, and bump it on logout,
 deactivation and role change. Also cut the TTL (e.g. 8 h → 2–4 h), or add an idle timeout (M)
 ────────────────────────────────────────
 ID: 03 Clickjacking
 Risk: Med
 Still valid at HEAD?: Yes
 Root cause in code: frontend/next.config.ts has no headers()
 Impact if left: Login page can be framed (UI redress)
 Fix (effort): headers() in next.config.ts with X-Frame-Options: DENY + CSP: frame-ancestors 'none' (XS)
 ────────────────────────────────────────
 ID: 04 No HSTS
 Risk: Med
 Still valid at HEAD?: Yes
 Root cause in code: Same
 Impact if left: SSL-strip on first visit
 Fix (effort): Strict-Transport-Security: max-age=31536000; includeSubDomains, same place (XS)
 ────────────────────────────────────────
 ID: 05 API key in JS bundle
 Risk: Med
 Still valid at HEAD?: Yes
 Root cause in code: frontend/src/lib/api/client.ts:7 NEXT_PUBLIC_API_KEY. main.py:66,76 requires it on every router. Prod is running the
 default-like value local-dev-key
 Impact if left: No real protection. Prod runs a dev secret
 Fix (effort): Remove verify_api_key from the browser-facing routers; the session cookie is the real authentication. Keep CSRF defence: the
 report credits the custom header as a CSRF mitigation, so replace it with a required non-secret header such as X-Requested-With. Make sure
 the backend binds only to 127.0.0.1 (the EC2 doc already does this) (S)
 ────────────────────────────────────────
 ID: 06 Hard delete of users
 Risk: Med
 Still valid at HEAD?: Yes
 Root cause in code: The generic build_crud_router DELETE in users.py:47. Only 5 of 22 FKs to users.id cascade
 Impact if left: A single call destroys an account. Its cascaded rows are lost
 Fix (effort): Replace the users DELETE with a soft delete (is_active=false, which already exists) plus a UserActivityLog audit entry
 (models/audit.py). Add a type-the-name confirm in the Users UI. Review the factory DELETE on other entities as a follow-up (S–M)
 ────────────────────────────────────────
 ID: 07 Weak password policy
 Risk: Med
 Still valid at HEAD?: Password mode only
 Root cause in code: schemas/users.py:10 PASSWORD_MIN_LENGTH = 8, length check only
 Impact if left: Trivial passwords allowed
 Fix (effort): Min 12 + common/breached blocklist + reject identifier-like passwords, in PasswordChange and the admin set-password route. Moot
 under Entra (S)
 ────────────────────────────────────────
 ID: 08 Timing enumeration
 Risk: Med
 Still valid at HEAD?: Password mode only
 Root cause in code: auth.py:94: scrypt verify_password runs only when the user exists, so there's a ~112 ms gap
 Impact if left: Valid e-mails can be confirmed
 Fix (effort): On unknown or inactive users, run verify_password against a fixed dummy hash so timing is equal (XS)
 ────────────────────────────────────────
 ID: 09 Missing nosniff, Referrer-Policy, Permissions-Policy
 Risk: Low
 Still valid at HEAD?: Yes
 Root cause in code: No headers set
 Impact if left: Minor
 Fix (effort): Same headers() block (XS)
 ────────────────────────────────────────
 ID: 10 Tech disclosure
 Risk: Low
 Still valid at HEAD?: Yes
 Root cause in code: Next.js X-Powered-By, uvicorn Server header, raw pydantic 422 bodies
 Impact if left: Easier reconnaissance
 Fix (effort): poweredByHeader: false; run uvicorn with --no-server-header; nginx server_tokens off. Don't make 422s generic: client.ts:36
 reads the 422 detail array for inline errors. Instead, strip input/ctx/url from the body in a RequestValidationError handler (S)
 ────────────────────────────────────────
 ID: 11 Cookie lacks Secure
 Risk: Low
 Still valid at HEAD?: Config only
 Root cause in code: config.py:21 session_cookie_secure=False by default
 Impact if left: Cookie could go out over plain HTTP
 Fix (effort): Set SESSION_COOKIE_SECURE=true in prod .env (config only, XS)
 ────────────────────────────────────────
 ID: 12 Client-only route guard
 Risk: Low
 Still valid at HEAD?: Yes
 Root cause in code: components/shell/auth-guard.tsx is client-side. There's no proxy.ts (middleware.ts)
 Impact if left: App shell is visible to anonymous users. Data stays protected (API returns 401)
 Fix (effort): Add frontend/src/proxy.ts that redirects to /login when the pg_session cookie is missing, excluding /login*, /api/* and static
 assets (S)
 ────────────────────────────────────────
 ID: 13 No MFA
 Risk: Info
 Still valid at HEAD?: Moot under Entra
 Root cause in code: mfa_enrolled column is unused
 Impact if left: —
 Fix (effort): Enforce MFA through Entra Conditional Access, not in the app (config)
 ────────────────────────────────────────
 ID: 14 Static HS256 secret
 Risk: Info
 Still valid at HEAD?: Yes
 Root cause in code: core/session.py. Defaults to change-me-session-secret if .env is missing
 Impact if left: All tokens can be forged if the secret leaks
 Fix (effort): Confirm the prod secret is 32+ random bytes and rotate it. Fail startup when api_key, session_secret or auth_type=no_password
 are still on dev defaults outside dev (XS)
 ────────────────────────────────────────
 ID: 15 Inactive SSO endpoint
 Risk: Info
 Still valid at HEAD?: Already fixed (OneLogin removed)
 Root cause in code: —
 Impact if left: —
 Fix (effort): Retest only. The Entra routes return 404 unless auth_type=entra

 Extra risks the report didn't cover (found during the code read)

 - AUTH_TYPE=no_password is the code default (config.py:18), and both deployment docs tell you to start with it. In that mode, anyone who knows an e-mail can log in as that user, including ADMIN. It must never run on an internet-reachable host. The startup guard above coversthis.
 - Role-separation retest is outstanding. The testers had only ADMIN accounts, so vertical privilege escalation was not tested. Example: GET/audit-log (endpoints/audit.py) has no require_role, so check whether any user can read the whole activity log.

 Operational follow-up from the incident (no code)

 - Since the 8 Oct test, hari.g in prod has a new UUID 89df3c74… (was 8dcc6aa3…) and password_set=false. Rows in the 5 cascading tables (e.g. user-account/geo mappings, notifications) were lost. Check and re-create these mappings, and reset the local password if password mode is still in use.
 - Ask the testers to use only non-destructive methods (OPTIONS) on production-like data in the retest. Better still, give them a stagingcopy.

 Prioritised plan

 Step 0: deployment and config only, no code (do first, 0–3 days)
 1. Switch prod to AUTH_TYPE=entra (EC2 doc step 12) and enable Conditional Access MFA. This neutralises 01, 07, 08 and 13.
 2. Set SESSION_COOKIE_SECURE=true (11). Rotate SESSION_SECRET to 32+ random bytes (14), which also logs out all existing tokens. Rotate API_KEY away from local-dev-key (05, interim).
 3. nginx: server_tokens off, limit_req on /api/v1/auth/. Uvicorn: --no-server-header (part of 10, 01).
 4. Fix hari.g's lost mappings (incident).

 P1: code, 0–7 days
 5. Logout revocation via session_version (02). Touches models/users.py, a db migration, core/session.py, api/deps.py:get_current_user, auth.py:logout, and the users.py deactivate/role-change paths.
 6. Remove the client API key and require a CSRF header instead (05). Touches main.py, core/security.py, frontend/src/lib/api/client.ts and the download helpers that send X-API-Key (documents.ts, executive-updates.ts, project-status.ts, customer-communications.ts), plus.env.example.
 7. Startup guard that refuses dev defaults in non-dev (14 + no_password risk). Touches core/config.py.

 P2: 7–30 days
 8. Security headers + poweredByHeader:false in next.config.ts, with CSP sent as Report-Only first, because Next injects inline scripts (03, 04, 09, 10).
 9. Soft delete + audit + UI confirm for users (06).
 10. App-level login limiter, constant-time login, stronger password rule (01, 07, 08). Only needed if password mode stays in use anywhere.

 P3: next cycle
 11. proxy.ts server-side route guard (12).
 12. Trimmed 422 bodies (10).
 13. Role-separation audit of every endpoint with a non-admin account, starting with /audit-log.

 Retest: ask the vendor to retest 01, 02 and 05 plus a TEAM_MEMBER/PM role-separation pass, as the report itself recommends.

 Verification (when implemented)

 - Backend pytest:
   - a token replayed after logout gets 401
   - a token with an old ver gets 401
   - DELETE on a user leaves the row with is_active=false and writes an audit row
   - startup raises on default secrets when env≠dev
   - a 6th login attempt within the window gets 429
 - curl -sI https://<host>/login shows HSTS, XFO, CSP frame-ancestors, nosniff, Referrer-Policy and Permissions-Policy, and no X-Powered-By or Server: uvicorn.
 - Set-Cookie: pg_session includes Secure.
 - An anonymous curl -I /admin/users gets a 307 to /login from the server.
 - grep of .next/static finds no API key.
 - tsc, eslint and next build all clean (the user runs the dev server).