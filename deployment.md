**This is a fresh machine with a fresh Postgres instance — no existing data to preserve.**

**Packaging**

Use `git clone` with sparse-checkout — no manual archive needed, since the repo already has the current state pushed. A plain clone would also drag along internal planning/docs content that has nothing to do with running the app (`product-brain/`, `design-reference/`, `docs/`, `sample/`, root `scripts/`, `.claude/`, the various `*_REVIEW.md`/`*_FIX_PLAN.md` files, requirement `.xlsx` files, `vapt-prompt.txt`, etc.) — only `backend/`, `frontend/`, `db/`, and this file are actually needed. Sparse-checkout still clones full history (so `git pull` keeps working for updates), it just only materializes the paths you list:

Commit and push any local changes first (e.g. this file), then on the new machine:
```
git clone --no-checkout -b GeoAccountDev https://github.com/gharibct/BCTProjectGovernance.git
cd BCTProjectGovernance
git sparse-checkout init --cone
git sparse-checkout set backend frontend db deployment.md
git checkout GeoAccountDev
```
(`origin` on this machine points at that same repo — `origin1` is a second remote, `https://github.com/ghariharasudhan/ProjectGovernance.git`, kept in sync but not the one to clone from.)

`.venv`, `node_modules`, `.next`, `dev.db`, `storage/`, and both `.env`/`.env.local` files are all git-ignored on top of that, so the checkout naturally excludes them too — `backend/.env` and `frontend/.env.local` get created fresh on the new machine per the steps below.

**Files you need to change on the new server**

backend/.env (copy from .env.example, then edit):
DATABASE_URL=postgresql+asyncpg://postgres:<password>@localhost:5432/project_governance
API_KEY=<pick a real secret>
CORS_ORIGINS=http://<new-server-ip-or-domain>:3000
Point DATABASE_URL at the new box's own Postgres instance (localhost, once you've created the database there — see step 0 below), not at 192.168.1.175. Set CORS_ORIGINS to wherever the frontend will actually be reached from — otherwise the browser will get CORS errors.

Auth (see the OneLogin SSO integration plan for the full picture):
AUTH_TYPE=no_password | onelogin
SESSION_SECRET=<pick a real secret>
SESSION_TTL_MINUTES=480
SESSION_COOKIE_SECURE=false   # set true once this box is served over HTTPS
FRONTEND_BASE_URL=http://<new-server-ip-or-domain>:3000
ONELOGIN_CLIENT_ID=, ONELOGIN_CLIENT_SECRET=, ONELOGIN_ISSUER=, ONELOGIN_REDIRECT_URI=
  — only needed once AUTH_TYPE=onelogin; AUTH_TYPE=onelogin also requires
  HTTPS on this box (OneLogin won't redirect to a plain-HTTP non-localhost
  URL) — keep AUTH_TYPE=no_password until the reverse-proxy/TLS setup below
  is in place.

frontend/.env.local:
NEXT_PUBLIC_API_KEY=<same value as backend API_KEY>
API_PROXY_TARGET=http://<new-server-ip-or-domain>:8000
NEXT_PUBLIC_API_KEY must match the backend's API_KEY — the frontend sends it
as the X-API-Key header, and the backend checks it against API_KEY.
API_PROXY_TARGET is where next.config.ts's rewrite proxies /api/v1/* to — the
browser always calls the frontend's own origin (same-origin, no CORS, and
required for the OneLogin session cookie to work), and Next.js forwards those
requests server-side to the backend.

Steps

0. Database (new Postgres instance — nothing exists yet)
- Install Postgres on the new machine if it isn't already, and create the database:
  createdb -U postgres project_governance
- Load the schema (run from the repo root so \ir's relative paths resolve):
  psql -U postgres -d project_governance -f db/run_all.sql
- Seed the minimum required to use the app — role codes the backend checks
  by name, reporting periods the dropdowns need, and one Admin user so
  someone can log in at all (AUTH_TYPE=no_password looks up an existing
  users row by identifier — an empty users table means nobody can sign in):
  psql -U postgres -d project_governance -f db/seed_deployment.sql
  Edit the identifier/email/name in that file first if the seeded Admin
  shouldn't be hari.g@bahwancybertek.com. Everything else — organizations,
  geos, regions, project types, products, accounts — is deliberately left
  out; add real values afterward via the app once logged in as Admin
  (Admin screens, or the Master Data Excel import/export tool).
- db/seed_dev.sql and the various db/add_*.sql files are NOT needed here:
  seed_dev.sql is dev-only demo data (fictional accounts/projects, extra
  demo logins), and the add_*.sql scripts are additive patches for an
  already-deployed database — db/tables/19_de_assessments.sql already has
  the final shape, so run_all.sql alone gives you the current schema.

1. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
# create/edit .env as above
uvicorn app.main:app --host 0.0.0.0 --port 8000

2. Frontend
cd frontend
npm install
# create/edit .env.local as above
npm run build
npm run start -- -p 3000       # or set PORT env var

3. Networking
- Open inbound ports 8000 and 3000 on the new server's firewall.
- Postgres is local to this box, so no inbound firewall rule is needed for it - just confirm it's listening on localhost:5432 (default) since the backend runs on the same machine.

4. Keep it running
Since these are bare uvicorn/next start processes, use a process manager so they survive reboots/logouts:
- Windows: NSSM (wrap each as a service) or Task Scheduler.
- If you want a single reverse proxy in front (recommended for real deployment) so users hit one port/domain: put IIS/nginx in front, proxying /api/* → :8000 and everything else → :3000. Then NEXT_PUBLIC_API_BASE_URL becomes https://<domain>/api/v1 and CORS_ORIGINS can even be dropped to same-origin.

Want me to check what OS/web server the new box runs (IIS vs nginx vs plain) so I can give exact reverse-proxy config, or set up an NSSM/systemd service file?