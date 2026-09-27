-- Additive migration for an already-deployed DB: adds products.product_group,
-- the portfolio each product rolls up to (drives the grouped Product dropdown
-- on the Project Profile). Nullable, so existing product rows are unaffected
-- (ungrouped products render under "Other"). Safe to re-run.

ALTER TABLE products ADD COLUMN IF NOT EXISTS product_group TEXT;

-- Optional: group the catalog. Match on code; add rows for any products that
-- don't exist yet in your DB.
UPDATE products SET product_group = 'Digital Experience' WHERE code IN ('dropthought', 'dtWorks');
UPDATE products SET product_group = 'Digital Supply Chain Management' WHERE code IN ('CueTrans', 'FuelTrans', 'Procure360', 'IVMS');
UPDATE products SET product_group = 'Predictive Analytics' WHERE code IN ('retina360', 'rt360', 'Geodatafy', 'midas360', 'radar360');
UPDATE products SET product_group = 'Payments' WHERE code IN ('ePAY', 'eREMIT');
