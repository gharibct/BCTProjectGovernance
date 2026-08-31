from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.deps import get_current_user, touch_project_on_write
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.router import api_router
from app.core.config import settings
from app.core.security import verify_api_key

app = FastAPI(title="Project Governance Tool API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Only used transiently by Authlib to hold OIDC state/nonce/PKCE during the
# OneLogin redirect round-trip (see auth.py's onelogin_login/onelogin_callback)
# — separate from our own long-lived pg_session app cookie (core/session.py).
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret,
    same_site="lax",
    https_only=settings.session_cookie_secure,
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


# /auth/* must stay reachable without an existing session (login/callback/config).
app.include_router(auth_router, prefix="/api/v1", dependencies=[Depends(verify_api_key)])
# Everything else now requires both the shared API key and a valid session.
# touch_project_on_write records project activity after any successful write to a
# project-scoped route (no-op for reads / non-project paths / in unit tests).
app.include_router(
    api_router,
    prefix="/api/v1",
    dependencies=[
        Depends(verify_api_key),
        Depends(get_current_user),
        Depends(touch_project_on_write),
    ],
)
