**Files you need to change on the new server**

backend/.env (copy from .env.example, then edit):
DATABASE_URL=postgresql+asyncpg://postgres:postgres@192.168.1.175:5432/Project_Governance_01
API_KEY=<pick a real secret>
CORS_ORIGINS=http://<new-server-ip-or-domain>:3000
Keep the DB host as 192.168.1.175 (unchanged). Set CORS_ORIGINS to wherever the frontend will actually be reached from — otherwise the browser will get CORS errors.

frontend/.env.local:
NEXT_PUBLIC_API_BASE_URL=http://<new-server-ip-or-domain>:8000/api/v1
NEXT_PUBLIC_API_KEY=<same value as backend API_KEY>
These two must match — the frontend sends NEXT_PUBLIC_API_KEY as the X-API-Key header, and the backend checks it against API_KEY.

Steps

1. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
# create/edit .env as above
uvicorn app.main:app --host 0.0.0.0 --port 8000
No migrations to run — the schema already exists on 192.168.1.175 and you're not touching it.

2. Frontend
cd frontend
npm install
# create/edit .env.local as above
npm run build
npm run start -- -p 3000       # or set PORT env var

3. Networking
- Open inbound ports 8000 and 3000 on the new server's firewall.
- On the DB server (192.168.1.175), confirm pg_hba.conf/firewall allows inbound Postgres connections (port 5432) from the new server's IP — if the DB previously only accepted connections from your old machine's IP, it'll need to allow the new one too.

4. Keep it running
Since these are bare uvicorn/next start processes, use a process manager so they survive reboots/logouts:
- Windows: NSSM (wrap each as a service) or Task Scheduler.
- If you want a single reverse proxy in front (recommended for real deployment) so users hit one port/domain: put IIS/nginx in front, proxying /api/* → :8000 and everything else → :3000. Then NEXT_PUBLIC_API_BASE_URL becomes https://<domain>/api/v1 and CORS_ORIGINS can even be dropped to same-origin.

Want me to check what OS/web server the new box runs (IIS vs nginx vs plain) so I can give exact reverse-proxy config, or set up an NSSM/systemd service file?