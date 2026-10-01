-- Applicable Phase "Support" was replaced by Support L0/L1/L2/L3 (see
-- ApplicablePhase in backend/app/schemas/enums.py). Drop the retired value
-- from existing projects' comma-joined applicable_phase so they still load;
-- users re-pick the appropriate Support level(s) on the charter.
UPDATE projects
SET applicable_phase = NULLIF(
    array_to_string(array_remove(string_to_array(applicable_phase, ','), 'Support'), ','), '')
WHERE applicable_phase IS NOT NULL
  AND 'Support' = ANY (string_to_array(applicable_phase, ','));
