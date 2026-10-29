-- Data patch: Potential Red is no longer a valid rating on the Project and Account
-- Delivery Status (RAG) reports. Re-state every existing Potential Red as Amber.
-- DE Assessment ratings (de_assessments) are NOT touched - Potential Red stays valid there.
-- Geo RAG (geo_health_declarations) is NOT touched - add it below if Geo should follow.
-- Safe to re-run (idempotent). Run inside one transaction; check the counts, then COMMIT.

BEGIN;

-- 1. Project RAG declarations (6 categories + auto-calculated overall).
UPDATE health_declarations
SET core_delivery_rating = CASE WHEN core_delivery_rating = 'Potential Red' THEN 'Amber' ELSE core_delivery_rating END,
    people_rating        = CASE WHEN people_rating        = 'Potential Red' THEN 'Amber' ELSE people_rating        END,
    operational_rating   = CASE WHEN operational_rating   = 'Potential Red' THEN 'Amber' ELSE operational_rating   END,
    customer_rating      = CASE WHEN customer_rating      = 'Potential Red' THEN 'Amber' ELSE customer_rating      END,
    financial_rating     = CASE WHEN financial_rating     = 'Potential Red' THEN 'Amber' ELSE financial_rating     END,
    compliance_rating    = CASE WHEN compliance_rating    = 'Potential Red' THEN 'Amber' ELSE compliance_rating    END,
    overall_rating       = CASE WHEN overall_rating       = 'Potential Red' THEN 'Amber' ELSE overall_rating       END
WHERE 'Potential Red' IN (core_delivery_rating, people_rating, operational_rating,
                          customer_rating, financial_rating, compliance_rating, overall_rating);

-- 2. Account RAG declarations (same shape).
UPDATE account_health_declarations
SET core_delivery_rating = CASE WHEN core_delivery_rating = 'Potential Red' THEN 'Amber' ELSE core_delivery_rating END,
    people_rating        = CASE WHEN people_rating        = 'Potential Red' THEN 'Amber' ELSE people_rating        END,
    operational_rating   = CASE WHEN operational_rating   = 'Potential Red' THEN 'Amber' ELSE operational_rating   END,
    customer_rating      = CASE WHEN customer_rating      = 'Potential Red' THEN 'Amber' ELSE customer_rating      END,
    financial_rating     = CASE WHEN financial_rating     = 'Potential Red' THEN 'Amber' ELSE financial_rating     END,
    compliance_rating    = CASE WHEN compliance_rating    = 'Potential Red' THEN 'Amber' ELSE compliance_rating    END,
    overall_rating       = CASE WHEN overall_rating       = 'Potential Red' THEN 'Amber' ELSE overall_rating       END
WHERE 'Potential Red' IN (core_delivery_rating, people_rating, operational_rating,
                          customer_rating, financial_rating, compliance_rating, overall_rating);

-- 3. Denormalised project caches. Delivery-declared health moves to Amber; the
--    overall is then re-derived as worst-of(delivery declared, DE assessed), so a
--    project whose DE assessment is still Potential Red keeps Potential Red overall.
UPDATE projects
SET delivery_declared_overall_health = 'Amber'
WHERE delivery_declared_overall_health = 'Potential Red';

UPDATE projects
SET overall_project_health = CASE
        WHEN 'Red' IN (delivery_declared_overall_health, de_assessed_project_health) THEN 'Red'
        WHEN 'Potential Red' IN (delivery_declared_overall_health, de_assessed_project_health) THEN 'Potential Red'
        WHEN 'Amber' IN (delivery_declared_overall_health, de_assessed_project_health) THEN 'Amber'
        WHEN 'Green' IN (delivery_declared_overall_health, de_assessed_project_health) THEN 'Green'
        ELSE overall_project_health
    END
WHERE overall_project_health = 'Potential Red';

-- Optional - Geo RAG, uncomment if Geo should follow:
-- UPDATE geo_health_declarations SET
--     core_delivery_rating = CASE WHEN core_delivery_rating = 'Potential Red' THEN 'Amber' ELSE core_delivery_rating END,
--     people_rating        = CASE WHEN people_rating        = 'Potential Red' THEN 'Amber' ELSE people_rating        END,
--     operational_rating   = CASE WHEN operational_rating   = 'Potential Red' THEN 'Amber' ELSE operational_rating   END,
--     customer_rating      = CASE WHEN customer_rating      = 'Potential Red' THEN 'Amber' ELSE customer_rating      END,
--     financial_rating     = CASE WHEN financial_rating     = 'Potential Red' THEN 'Amber' ELSE financial_rating     END,
--     compliance_rating    = CASE WHEN compliance_rating    = 'Potential Red' THEN 'Amber' ELSE compliance_rating    END,
--     overall_rating       = CASE WHEN overall_rating       = 'Potential Red' THEN 'Amber' ELSE overall_rating       END
-- WHERE 'Potential Red' IN (core_delivery_rating, people_rating, operational_rating,
--                           customer_rating, financial_rating, compliance_rating, overall_rating);

-- Verification: expect 0 for the first three; the last may be > 0 (DE-driven).
SELECT 'health_declarations'         AS tbl, count(*) FROM health_declarations         WHERE overall_rating = 'Potential Red'
UNION ALL
SELECT 'account_health_declarations',          count(*) FROM account_health_declarations WHERE overall_rating = 'Potential Red'
UNION ALL
SELECT 'projects.delivery_declared',           count(*) FROM projects                    WHERE delivery_declared_overall_health = 'Potential Red'
UNION ALL
SELECT 'projects.overall (DE-driven ok)',      count(*) FROM projects                    WHERE overall_project_health = 'Potential Red';

COMMIT;
