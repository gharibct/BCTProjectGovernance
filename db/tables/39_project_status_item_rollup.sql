-- Project -> Account rollup (see backend/app/services/account_rollup.py):
-- tracks whether a project's own status item has been pulled into its
-- account's register or dismissed. A later, separate ALTER (rather than
-- edited into 35_project_status_items.sql's CREATE TABLE) because the FK
-- target, account_status_items, is defined in 36 — after 35 — so inlining
-- it there would break a fresh run_all.sql on the forward reference.

ALTER TABLE project_status_items ADD COLUMN account_rollup_status TEXT NOT NULL DEFAULT 'Pending';
ALTER TABLE project_status_items ADD COLUMN rolled_up_account_item_id UUID REFERENCES account_status_items(id) ON DELETE SET NULL;
