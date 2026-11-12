-- Rename contract type value "Capped T&M" -> "Capped FP"
UPDATE projects SET contract_type = 'Capped FP' WHERE contract_type = 'Capped T&M';
