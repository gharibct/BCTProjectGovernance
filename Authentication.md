ady to code?                                                                                                                           
 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 OneLogin SSO Integration

 Context

 Authentication in Project Governance Tool is currently a placeholder: POST /api/v1/auth/login
 (backend/app/api/v1/endpoints/auth.py) resolves a free-text identifier to a User row with
 no password check at all (explicitly commented as a prototype stopgap). The result is handed
 to the frontend and stored in a Zustand store persisted to localStorage
 (frontend/src/stores/session.ts) — that's the entire "session." The only server-side gate on
 the API is a single shared static secret (X-API-Key, backend/app/core/security.py,
 enforced once at router-inclusion in backend/app/main.py) — there is no per-request identity
 check anywhere in the backend (no get_current_user dependency exists today). Route protection
 on the frontend (frontend/src/components/shell/auth-guard.tsx) is a client-side-only redirect.

 The org has standardized on OneLogin for SSO, so this work replaces the identifier-only login
 with real OneLogin authentication, and — per the user's decision — also closes the server-side
 enforcement gap at the same time, since shipping OneLogin without backend session verification
 would just be a fancier login screen with nothing real behind it.                                                                                                                                       cisions locked in with the user:Protocol: OIDC (not SAML) — simpler for FastAPI + Next.js, no XML metadata/cert exchange.                                              Provisioning: strict pre-provisioned only — login fails unless an admin already created the
 User row with role/geo/account scoping. No auto-create-on-login.
 - A config toggle AUTH_TYPE = no_password | onelogin stays in the codebase during the
 development phase, so the old identifier-only flow keeps working for local dev while OneLogin
 is rolled out to shared/prod environments.
 - Also add real server-side session enforcement (signed session cookie + get_current_user
 dependency), not just a login-screen swap.
 - Infra prerequisite flagged, not solved by this plan's code changes: the app is currently
 HTTP-only on internal IPs (per deployment.md); OneLogin requires HTTPS redirect URIs for any
 non-localhost environment. This needs a reverse proxy + TLS cert in front of shared/prod
 environments before AUTH_TYPE=onelogin can be enabled there. Local dev is unaffected since
 OneLogin allows http://localhost redirect URIs.

 ---
 Part A — What's needed from OneLogin (org admin side)

 Someone with OneLogin admin rights needs to:

 1. Create an OIDC application in the OneLogin admin portal: Applications → Add App → "OpenId
 Connect (OIDC)". Type: Web (confidential client — our FastAPI backend holds the secret
 server-side, never exposed to the browser). Suggest one app per environment (Dev/Test/Prod) so
 redirect URIs and audit trails stay separate.
 2. Register redirect URI(s) (exact match required):
   - Dev: http://localhost:8000/api/v1/auth/onelogin/callback
   - Shared/Prod: https://<app-domain>/api/v1/auth/onelogin/callback (needs the HTTPS domain
 from the infra prerequisite above)
   - Optional sign-out redirect URI: .../login on the same host, for single-logout.
 3. Scopes: openid email profile — email is the join key back to our users table.
 4. Hand over three values per environment: Client ID, Client Secret, and the OneLogin
 issuer URL (https://<subdomain>.onelogin.com/oidc/2). That issuer URL is all the backend
 needs — the .well-known/openid-configuration document under it is auto-discovered, so no
 manual endpoint/JWKS configuration is required (this is the main advantage over SAML, which
 would need metadata/certificate exchange instead).
 5. Assign the app to the right users/groups in OneLogin (Applications → Rules or the app's
 Users tab) — this governs who can obtain a token for this app at all. It's a separate gate
 from our own pre-provisioned-User check: OneLogin decides who may attempt sign-in, our backend
 decides whether that person has an app account with role/scope assigned.
 6. Confirm email consistency: the email claim OneLogin asserts must match (case-insensitive)
 the email already seeded in our users table, or the callback will 403 even though OneLogin
 auth succeeded. Worth a quick check with the OneLogin admin on which email OneLogin will send
 (corporate vs. any personal/alias address on file).

 No SAML metadata upload, no certificate rotation, no ACS URL — OIDC keeps the OneLogin-side setup
 to the app registration above.

 ---
 Part B — Code changes (backend)

 New/changed files:

 - backend/requirements.txt — add authlib (OIDC client, discovery, PKCE, token/JWKS validation)
 and pyjwt (signing our own session token).
 - backend/app/core/config.py — add settings: auth_type: str = "no_password",
 session_secret: str, session_ttl_minutes: int = 480, and OneLogin settings
 (onelogin_client_id, onelogin_client_secret, onelogin_issuer, onelogin_redirect_uri,
 frontend_base_url) — all only required when auth_type=onelogin.
 - backend/app/core/session.py (new) — create_session_token(user) / decode_session_token(token)
 using PyJWT (HS256, signed with session_secret), plus the cookie name constant
 (pg_session, httpOnly, SameSite=Lax, Secure when not on localhost).
 - backend/app/api/deps.py — add get_current_user(request, db): reads the session cookie,
 decodes/validates it, loads the User, 401s if missing/invalid/inactive. This is the dependency
 that's been missing entirely.
 - backend/app/main.py — restructure router mounting: /api/v1/auth/* keeps only
 verify_api_key (must be reachable pre-session); everything else under /api/v1 gets both
 verify_api_key and get_current_user. Also set allow_credentials=True on CORS
 middleware (needed for the session cookie).
 - backend/app/api/v1/endpoints/auth.py — rewrite:
   - Existing POST /auth/login (identifier-only) stays, gated by
 if settings.auth_type != "no_password": 403; on success it now also sets the session cookie.
   - GET /auth/config — public-ish, returns {"auth_type": settings.auth_type} so the frontend
 knows which login UI to render without a rebuild.
   - GET /auth/onelogin/login — active only when auth_type=onelogin; builds the OneLogin
 authorization URL via Authlib (PKCE + state), redirects the browser.
   - GET /auth/onelogin/callback — exchanges the code for tokens, validates the id_token
 (issuer/audience/signature via OneLogin's JWKS — handled by Authlib), reads the email claim,
 looks up the local User by email (case-insensitive; 403 if not found/inactive — the strict
 pre-provisioned policy), sets the session cookie, redirects to
 ${frontend_base_url}/login/callback.
   - GET /auth/me — requires get_current_user, returns the same UserSessionRead shape used
 today; the frontend calls this after the OneLogin redirect (and can call it on app boot) to
 populate its store.
   - POST /auth/logout — clears the session cookie; if auth_type=onelogin, also return
 OneLogin's end-session URL for single-logout.

 This reuses the existing UserSessionRead/RoleRead shapes and the existing geo/account lookup
 logic already in auth.py — no schema changes needed there.

 ---
 Part C — Code changes (frontend)

 - frontend/next.config.ts — add rewrites() proxying /api/:path* to the backend. This makes
 the browser talk to the backend as same-origin in every environment (dev included), which is
 what makes the httpOnly session cookie work without needing HTTPS locally and without CORS
 complexity. frontend/src/lib/api/client.ts's BASE_URL becomes the relative /api/v1, and
 every request adds credentials: "include". The X-API-Key header stays as-is (defense in
 depth, unchanged).
 - frontend/src/lib/api/auth.ts — add useAuthConfig() (GET /auth/config), useMe()
 (GET /auth/me), useLogout() (POST /auth/logout); keep the existing useLogin() for the
 no_password path.
 - frontend/src/components/auth/login-form.tsx — branch on useAuthConfig().auth_type: keep
 today's identifier-only form when no_password; render a single "Sign in with OneLogin" button
 (full-page redirect to /api/v1/auth/onelogin/login) when onelogin.
 - frontend/src/app/login/callback/page.tsx (new) — lands here after the backend's OneLogin
 callback redirect; calls useMe(), populates the Zustand store via the existing signIn(user)
 action, then routes via the existing ROLE_LANDING_ROUTE[role.code] map
 (frontend/src/lib/menu-config.ts) — mirrors the post-login logic already in login-form.tsx.
 - frontend/src/lib/api/client.ts — on a 401 response, clear the Zustand session and redirect
 to /login (handles expired/revoked server sessions even if stale state lingers in
 localStorage).
 - frontend/.env.local / deployment docs — no new required vars for the frontend itself (auth
 mode now comes from the backend via /auth/config), but deployment.md should note the new
 backend vars (AUTH_TYPE, SESSION_SECRET, ONELOGIN_*, FRONTEND_BASE_URL) alongside the
 existing ones.

 ---
 Sequencing

 1. Ship the backend/frontend changes above with AUTH_TYPE=no_password everywhere — this alone
 fixes the "no server-side identity enforcement" gap and is safe to deploy immediately, no
 OneLogin app needed yet.
 2. Get the OneLogin OIDC app created for Dev (localhost redirect URI, no TLS needed) and flip
 AUTH_TYPE=onelogin locally to validate the full flow end-to-end.
 3. Once the reverse-proxy/TLS prerequisite is in place for the shared/prod box(es), register the
 corresponding HTTPS redirect URI in OneLogin and flip AUTH_TYPE=onelogin there.

 Verification

 - Local: run backend + frontend per deployment.md, exercise both AUTH_TYPE=no_password (today'sow still works) and AUTH_TYPE=onelogin (redirect to OneLogin's hosted login, callback lands                                            e user back in, /auth/me returns the right role/geo/account scoping, protected pages 401→
direct to /login once the session cookie is cleared/expired).                                                                          Confirm a non-provisioned OneLogin account gets a clean 403 at the callback (strict                                                e-provisioned policy), not a silent auto-created account.
 - Confirm existing seeded dev users (acchead/geohead/cxo/pm) still work under
 AUTH_TYPE=no_password unchanged.
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌