-- AI Hub > Document Processing — files uploaded for a project, stored on
-- local disk under the backend's DOCUMENT_STORAGE_DIR setting (see
-- backend/app/api/v1/endpoints/documents.py), one subfolder per project:
-- "<project_code>_create" for New Project uploads, or
-- "<project_code>_<reporting_periods.code>" for Project Reporting uploads.
-- storage_path is the file's path relative to DOCUMENT_STORAGE_DIR — an
-- internal server detail, never exposed to the frontend (downloads go
-- through a dedicated endpoint instead of a raw path/URL).
--
-- ai_status: Not Processed | Processing | Processed | Excluded
-- (Pydantic-validated, see schemas.enums.DocumentAiStatus — no CHECK
-- constraint, per this schema's convention). "Processing" is a stub status
-- transition (a short simulated delay), not a real AI extraction pipeline —
-- same boundary as ai_suggestions/ai_row_suggestions. Excluded is a soft
-- delete of a Processed document (kept for future reference); Not Processed
-- documents are hard-deleted instead.

CREATE TABLE project_documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- DOCX, PDF, XLSX, OTHER
    storage_path TEXT NOT NULL,
    context TEXT NOT NULL, -- create, reporting
    period_id UUID REFERENCES reporting_periods(id), -- set when context = 'reporting'
    ai_status TEXT NOT NULL DEFAULT 'Not Processed',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_project_documents_project_id ON project_documents(project_id, created_at DESC);

CREATE TRIGGER trg_project_documents_updated_at BEFORE UPDATE ON project_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
