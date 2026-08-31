-- Additive migration for an already-deployed DB: DE governance approval
-- (design-reference/de-approval). Safe to run once against a live DB with
-- existing data — no drops of data; every new column is nullable. Fresh
-- installs get these from tables/03_projects.sql + tables/47_de_project_module_reviews.sql.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS de_review_status TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS de_review_remarks TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS de_reviewed_by UUID REFERENCES users(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS de_reviewed_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS de_allocated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_delivery_excellence_id ON projects(delivery_excellence_id);
CREATE INDEX IF NOT EXISTS idx_projects_de_review_status ON projects(de_review_status);

CREATE TABLE IF NOT EXISTS de_project_module_reviews (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    review_action TEXT NOT NULL DEFAULT 'Not Reviewed',
    remarks TEXT,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (project_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_de_project_module_reviews_project_id
    ON de_project_module_reviews(project_id);

-- Postgres CREATE TRIGGER has no IF NOT EXISTS — drop then recreate.
DROP TRIGGER IF EXISTS trg_de_project_module_reviews_updated_at ON de_project_module_reviews;
CREATE TRIGGER trg_de_project_module_reviews_updated_at
    BEFORE UPDATE ON de_project_module_reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
