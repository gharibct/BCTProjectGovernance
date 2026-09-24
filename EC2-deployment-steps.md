0. Before you log in

- Security group: inbound 80 and 443 only, from your allowed CIDR. Don't open 22, 3000, 8000 or 5432. Use SSM Session Manager, or temporarily allow SSH from your own IP.
- Attach an Elastic IP.
- If you added separate data volumes, format and mount them first: /var/lib/postgresql for Postgres and /opt/pgov/uploads for uploads. Otherwise everything lives on the root volume, which is fine for a first pass.

1. System packages

sudo apt update && sudo apt -y upgrade
sudo apt -y install git curl build-essential nginx ufw \
  python3 python3-venv python3-pip libpq-dev
sudo timedatectl set-timezone <your/Timezone>   # scheduler runs at 07:00 server-local time

2. PostgreSQL 16

sudo apt -y install postgresql postgresql-contrib
sudo systemctl enable --now postgresql

DBPASS=$(openssl rand -hex 16); echo "DB password: $DBPASS"   # save this
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '$DBPASS';"
sudo -u postgres createdb project_governance
Tune it for 16 GB (create /etc/postgresql/16/main/conf.d/pgov.conf):
shared_buffers = 3GB
effective_cache_size = 8GB
work_mem = 16MB
maintenance_work_mem = 512MB
max_connections = 100
log_min_duration_statement = 1000
sudo systemctl restart postgresql
It listens on localhost only by default, which is what you want.

***************************************************************
    Connecting Postgres from other machines
    1. Listen on the network interface

    Edit /etc/postgresql/16/main/postgresql.conf (or add a line to conf.d/pgov.conf if you created that file):
    listen_addresses = '*'

    2. Allow your IP in pg_hba.conf

    Append this to /etc/postgresql/16/main/pg_hba.conf, using your real public IP:
    host    project_governance    postgres    <YOUR_PUBLIC_IP>/32    scram-sha-256
    Use /32 so only that one address matches. Never use 0.0.0.0/0.

    3. Restart and check
    sudo systemctl restart postgresql
    sudo ss -tlnp | grep 5432          # should show 0.0.0.0:5432, not just 127.0.0.1
    sudo ufw status                    # if ufw is on: sudo ufw allow from <YOUR_PUBLIC_IP> to any port 5432

    4. Connect from your machine
    psql -h <SERVER_ELASTIC_IP> -U postgres -d project_governance
    Or in DBeaver or pgAdmin, use host = the Elastic IP, port 5432, database project_governance, user postgres and the DB password from step 2.
**********************************************************************

3. Node.js 22 LTS

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt -y install nodejs
node -v && npm -v
Next 16 needs Node 20.9 or newer.

4. App user and code

sudo useradd -m -s /bin/bash pgov
sudo mkdir -p /opt/pgov && sudo chown pgov:pgov /opt/pgov
sudo -iu pgov
cd /opt/pgov
git clone --no-checkout -b GeoAccountDev https://github.com/gharibct/BCTProjectGovernance.git app
cd app
git sparse-checkout init --cone
git sparse-checkout set backend frontend db deployment.md
git checkout GeoAccountDev
If the repo is private, use a deploy key or a personal access token for the clone.

5. Database schema and seed

cd /opt/pgov/app
export PGPASSWORD='<DB password>'
psql -h localhost -U postgres -d project_governance -f db/run_all.sql
Before seeding, edit db/seed_deployment.sql if needed. It creates one Admin user, hari.g / hari.g@bahwancybertek.com, and that is the login identifier. It also still inserts three demo accounts (Gulf National Bank, Pacific Retail Group, Liberty Insurance Co), even though deployment.md says accounts are left out. Remove those lines if you don't want them in production.
psql -h localhost -U postgres -d project_governance -f db/seed_deployment.sql
Don't run seed_dev.sql or the add_*.sql patches.

6. Backend

cd /opt/pgov/app/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

*************************
Installing using uv
# as the pgov user
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

cd /opt/pgov/app/backend
rm -rf .venv
uv venv --python 3.12 --seed .venv
.venv/bin/python --version                 # should say 3.12.x
.venv/bin/pip install -r requirements.txt
************************************

mkdir -p /opt/pgov/uploads/documents
cp .env.example .env
Generate secrets:
echo "API_KEY=$(openssl rand -hex 24)"; echo "SESSION_SECRET=$(openssl rand -hex 32)"
Edit /opt/pgov/app/backend/.env:
DATABASE_URL=postgresql+asyncpg://postgres:<DB password>@localhost:5432/project_governance
API_KEY=<generated>
CORS_ORIGINS=https://<DOMAIN>
DOCUMENT_STORAGE_DIR=/opt/pgov/uploads/documents
AUTH_TYPE=no_password
SESSION_SECRET=<generated>
SESSION_COOKIE_SECURE=true        # only once HTTPS is live (step 10); use false while testing over http
FRONTEND_BASE_URL=https://<DOMAIN>
ENABLE_SCHEDULER=true
NOTIFICATION_SCAN_HOUR=7
Keep AUTH_TYPE=no_password until HTTPS works, then switch to onelogin (step 12). Lock the file down with chmod 600 .env. Quick test:
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
# in another shell: curl http://127.0.0.1:8000/health   -> {"status":"ok"} ; Ctrl+C

7. Frontend

NEXT_PUBLIC_API_KEY and API_PROXY_TARGET are read at build time, so set them before you build.
cd /opt/pgov/app/frontend
cat > .env.local <<EOF
NEXT_PUBLIC_API_KEY=<same value as backend API_KEY>
API_PROXY_TARGET=http://127.0.0.1:8000
EOF
npm ci
npm run build
The build should fit comfortably in 16 GB. Exit the pgov shell with exit afterwards.

8. systemd services

Backend, /etc/systemd/system/pgov-backend.service:
[Unit]
Description=Project Governance API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
User=pgov
WorkingDirectory=/opt/pgov/app/backend
ExecStart=/opt/pgov/app/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
Frontend, /etc/systemd/system/pgov-frontend.service:
[Unit]
Description=Project Governance Web
After=network.target pgov-backend.service

[Service]
User=pgov
WorkingDirectory=/opt/pgov/app/frontend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
sudo systemctl daemon-reload
sudo systemctl enable --now pgov-backend pgov-frontend
systemctl status pgov-backend pgov-frontend
Keep --workers 1. The scheduler runs inside the app, so more workers would send duplicate notifications.

9. nginx reverse proxy

/etc/nginx/sites-available/pgov:
server {
    listen 80;
    server_name <DOMAIN>;
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
sudo ln -s /etc/nginx/sites-available/pgov /etc/nginx/sites-enabled/pgov
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
/api/v1/* goes to Next.js, which proxies it to the backend, so nginx needs only this one location. You can now browse to http://<DOMAIN> (or the Elastic IP) and sign in as hari.g.

10. HTTPS

Pick one:
- nginx with Let's Encrypt, if the domain is publicly resolvable and ports 80 and 443 are reachable:
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d <DOMAIN>
- ALB with an ACM certificate, if you prefer. Terminate TLS there and forward to the instance on port 80.

Then confirm SESSION_COOKIE_SECURE=true in the backend .env and run sudo systemctl restart pgov-backend.

11. Firewall and backups

sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable   # skip OpenSSH if you use SSM only
Nightly database dump, /etc/cron.d/pgov-backup:
0 2 * * * postgres pg_dump -Fc project_governance > /tmp/pgov.dump && aws s3 cp /tmp/pgov.dump s3://<bucket>/pgov-$(date +\%F).dump && rm /tmp/pgov.dump
This needs the AWS CLI and an instance role with write access to that bucket. Also enable daily EBS snapshots through AWS Backup, and cover the uploads directory as well.

12. Switching to OneLogin (once HTTPS works)

In the backend .env, set AUTH_TYPE=onelogin, ONELOGIN_CLIENT_ID, ONELOGIN_CLIENT_SECRET, ONELOGIN_ISSUER, and ONELOGIN_REDIRECT_URI=https://<DOMAIN>/api/v1/auth/onelogin/callback. Register that exact redirect URI in OneLogin, then restart the backend.

13. Updating later

sudo -iu pgov
cd /opt/pgov/app && git pull
cd backend && .venv/bin/pip install -r requirements.txt
cd ../frontend && npm ci && npm run build
exit
sudo systemctl restart pgov-backend pgov-frontend
If a release includes new db/add_*.sql patches, run those with psql before restarting.

Checks after deploy

- curl -s https://<DOMAIN>/health doesn't hit the backend directly, because nginx only forwards to Next. Check the backend with curl http://127.0.0.1:8000/health on the box, and the site in the browser.
- Logs: journalctl -u pgov-backend -f and journalctl -u pgov-frontend -f.
- Confirm uploads land in /opt/pgov/uploads/documents.

I can also write these as a single provisioning script, or add the CloudWatch agent config for memory and disk alarms.

