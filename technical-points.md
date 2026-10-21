Authentication improvements:
- Bearer token: let get_current_user read Authorization: Bearer <jwt> as well as the cookie. This is a few lines. The JWT payload and the checks stay the same.
- Machine clients: use per-client service credentials. Either put a per-integration API key in the DB and map each to a service user with a role, or use OAuth client-credentials against OneLogin. That replaces the shared X-API-Key with something that identifies a caller.
- Direct OneLogin tokens: the backend could validate OneLogin access tokens against the JWKS, so SPAs and other services don't need the cookie hop. It's more work and only worth it if you have such clients.
- The existing shared API key: I'd keep it as a coarse gate or drop it. It isn't a security boundary.