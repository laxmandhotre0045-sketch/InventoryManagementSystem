-- ---------------------------------------------------------------------------
-- Read-only verification, to run AFTER the category feature is deployed.
--
-- Every statement is a SELECT; this changes nothing. It answers the questions
-- the migration has to get right: did every component keep its identity, did
-- each one land in the category its old text said, and do the dashboard totals
-- still come out the same?
--
--   docker compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" inventory \
--     < scripts/verify-component-categories.sql
--
-- Compare section 7 against section 7 of inspect-component-categories.sql; the
-- two must be identical. The migration only fills in a column, so any change in
-- those totals means something other than the migration touched the data.
-- ---------------------------------------------------------------------------

SELECT '=== 1. The category table and the foreign key both exist ===' AS section;
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'components'
  AND COLUMN_NAME IN ('category', 'category_id');

SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'components'
  AND REFERENCED_TABLE_NAME = 'component_categories';

SELECT '=== 2. Categories, with how many components each holds ===' AS section;
SELECT
    cc.id,
    cc.name,
    COUNT(c.id)                                     AS total_components,
    COALESCE(SUM(c.status <> 'ARCHIVED'), 0)        AS non_archived
FROM component_categories cc
LEFT JOIN components c ON c.category_id = cc.id
GROUP BY cc.id, cc.name
ORDER BY cc.name;

SELECT '=== 3. No duplicate category names (must return zero rows) ===' AS section;
SELECT LOWER(TRIM(name)) AS normalised_name, COUNT(*) AS copies
FROM component_categories
GROUP BY LOWER(TRIM(name))
HAVING copies > 1;

SELECT '=== 4. Every component has a category (must return zero rows) ===' AS section;
SELECT id, item_code, component_name, status
FROM components
WHERE category_id IS NULL;

SELECT '=== 5. Old text vs new category — every row must read MATCH ===' AS section;
-- The migration's correctness in one query. For each component it compares the
-- legacy free-text value against the name of the category it now points at.
-- Anything other than MATCH or (was blank -> Uncategorized) is a mis-mapping.
SELECT
    c.item_code,
    c.component_name,
    CONCAT('[', COALESCE(c.category, 'NULL'), ']') AS legacy_text,
    cc.name                                        AS mapped_category,
    CASE
        WHEN c.category IS NULL OR TRIM(c.category) = ''
             THEN CONCAT('was blank -> ', cc.name)
        WHEN LOWER(TRIM(c.category)) = LOWER(cc.name) THEN 'MATCH'
        ELSE '*** MISMATCH ***'
    END AS verdict
FROM components c
LEFT JOIN component_categories cc ON cc.id = c.category_id
ORDER BY cc.name, LENGTH(c.item_code), c.item_code;

SELECT '=== 6. Mis-mappings only (must return zero rows) ===' AS section;
SELECT c.item_code, c.category AS legacy_text, cc.name AS mapped_category
FROM components c
LEFT JOIN component_categories cc ON cc.id = c.category_id
WHERE c.category IS NOT NULL
  AND TRIM(c.category) <> ''
  AND (cc.name IS NULL OR LOWER(TRIM(c.category)) <> LOWER(cc.name));

SELECT '=== 7. Totals — must equal the pre-migration figures exactly ===' AS section;
SELECT
    COUNT(*)                                                              AS total_components,
    SUM(status <> 'ARCHIVED')                                             AS non_archived,
    COALESCE(SUM(CASE WHEN status <> 'ARCHIVED' THEN quantity END), 0)    AS total_stock,
    COALESCE(SUM(CASE WHEN status <> 'ARCHIVED' AND unit_price IS NOT NULL
                      THEN quantity * unit_price END), 0)                 AS total_stock_value,
    (SELECT COUNT(*) FROM inventory_transactions)                         AS transactions
FROM components;

SELECT '=== 8. No component was duplicated by the migration ===' AS section;
-- The migration only ever runs UPDATEs against components, so this must stay
-- empty. A duplicated item code would mean rows were recreated rather than
-- updated — the one outcome the migration is written to avoid.
SELECT item_code, COUNT(*) AS copies
FROM components
GROUP BY item_code
HAVING copies > 1;

SELECT '=== 9. Display order the UI will use (category, then item code) ===' AS section;
SELECT
    cc.name AS category,
    c.item_code,
    c.component_name,
    c.quantity,
    c.status
FROM components c
LEFT JOIN component_categories cc ON cc.id = c.category_id
ORDER BY (cc.name IS NULL), cc.name ASC, LENGTH(c.item_code) ASC, c.item_code ASC;
