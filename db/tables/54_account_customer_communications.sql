-- Account Reporting -> Update Account QBR: a running history of an account's
-- QBRs with the customer (planned / actual date, status, next QBR date, title,
-- the presentation file, optional remarks). Not period-scoped and not part of
-- the submit/review workflow. The file itself is stored on disk under
-- document_storage_dir; only its original name and relative path live here.
-- status is a QbrStatus (Initiated / Scheduled / Conducted); a Conducted QBR
-- carries its actual date, title, presentation and next QBR date; the other
-- statuses carry none of them (enforced by the API).
-- An existing DB moves from the earlier reporting_date shape with
-- db/add_qbr_fields_customer_communications.sql.

CREATE TABLE IF NOT EXISTS account_customer_communications (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    planned_date DATE NOT NULL,
    actual_date DATE,
    status TEXT NOT NULL,
    next_qbr_date DATE,
    title TEXT,
    file_name TEXT,
    file_path TEXT,
    remarks TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_account_customer_communications_account
    ON account_customer_communications(account_id, planned_date DESC);

-- At most one open (Initiated / Scheduled) QBR per account. Saving a QBR as
-- Conducted opens the next one, Initiated on its Next QBR Date.
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_customer_communications_open
    ON account_customer_communications(account_id)
    WHERE status IN ('Initiated', 'Scheduled');

DROP TRIGGER IF EXISTS trg_account_customer_communications_updated_at ON account_customer_communications;
CREATE TRIGGER trg_account_customer_communications_updated_at BEFORE UPDATE ON account_customer_communications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
