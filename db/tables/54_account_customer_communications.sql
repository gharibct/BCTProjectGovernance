-- Account Reporting -> Customer Communications: a running history of the
-- meetings / presentations shared with an account's customer (reporting date,
-- title, the presentation file, optional remarks). Not period-scoped and not
-- part of the submit/review workflow. The file itself is stored on disk under
-- document_storage_dir; only its original name and relative path live here.
-- A brand-new table, so this same file is also the migration for an existing
-- DB (idempotent — safe to run once against a live one).

CREATE TABLE IF NOT EXISTS account_customer_communications (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    reporting_date DATE NOT NULL,
    title TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_customer_communications_account
    ON account_customer_communications(account_id, reporting_date DESC);

DROP TRIGGER IF EXISTS trg_account_customer_communications_updated_at ON account_customer_communications;
CREATE TRIGGER trg_account_customer_communications_updated_at BEFORE UPDATE ON account_customer_communications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
