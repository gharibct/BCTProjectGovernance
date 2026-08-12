-- Project Status grids (UX redesign: the 3 free-text Project Status sections
-- plus a new 4th "Key Risks / Issues" section became individual line-item
-- registers instead of one text blob each — see project_status_reports'
-- key_accomplishments/upcoming_key_releases/leadership_support_required,
-- now unused/deprecated but left in place). One row per line item, scoped
-- to a project + reporting period + category.

CREATE TABLE project_status_items (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    period_id UUID NOT NULL REFERENCES reporting_periods(id),
    category TEXT NOT NULL, -- Key Accomplishments, Upcoming Key Releases / Milestones / Actions, Leadership Support / Attention Required, Key Risks / Issues
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_project_status_items_project_period_category ON project_status_items(project_id, period_id, category);

CREATE TRIGGER trg_project_status_items_updated_at BEFORE UPDATE ON project_status_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
