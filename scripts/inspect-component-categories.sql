-- ---------------------------------------------------------------------------
-- Read-only inspection of the existing component data.
--
-- Run this BEFORE deploying the category feature. It changes nothing — every
-- statement is a SELECT — and it answers the one question the migration depends
-- on: which category names do the existing rows actually carry?
--
--   docker compose exec -T mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" inventory \
--     < scripts/inspect-component-categories.sql
--
-- The migration derives its mapping from the same `components.category` column
-- these queries read, so what you see here is exactly what it will act on.
-- ---------------------------------------------------------------------------

SELECT '=== 1. Does the legacy category column still exist? ===' AS section;
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'components'
  AND COLUMN_NAME IN ('category', 'category_id');

SELECT '=== 2. Has the feature already been deployed? ===' AS section;
SELECT COUNT(*) AS component_categories_table_exists
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'component_categories';

SELECT '=== 3. Distinct category values, exactly as stored ===' AS section;
-- This is the mapping the migration will build. Anything surprising here
-- (trailing spaces, "Resistors" vs "Resistor", mixed case) shows up now,
-- while it is still cheap to correct.
SELECT
    CONCAT('[', COALESCE(category, 'NULL'), ']') AS stored_value,
    COUNT(*)                                     AS component_count,
    SUM(status <> 'ARCHIVED')                    AS non_archived,
    MIN(item_code)                               AS first_item_code,
    MAX(item_code)                               AS last_item_code
FROM components
GROUP BY category
ORDER BY component_count DESC, category;

SELECT '=== 4. Case/whitespace variants that will merge into one category ===' AS section;
-- The migration matches case-insensitively on the trimmed name, so any group
-- returning more than one distinct raw value below will collapse into a single
-- category row. Confirm that is what you want.
SELECT
    LOWER(TRIM(category))                AS normalised_name,
    COUNT(DISTINCT category)             AS raw_variants,
    GROUP_CONCAT(DISTINCT CONCAT('[', category, ']') ORDER BY category SEPARATOR ' | ') AS variants,
    COUNT(*)                             AS component_count
FROM components
WHERE category IS NOT NULL AND TRIM(category) <> ''
GROUP BY LOWER(TRIM(category))
HAVING raw_variants > 1;

SELECT '=== 5. Components with no category (will become "Uncategorized") ===' AS section;
SELECT id, item_code, component_name, status, CONCAT('[', COALESCE(category, 'NULL'), ']') AS category
FROM components
WHERE category IS NULL OR TRIM(category) = ''
ORDER BY id;

SELECT '=== 6. Full component listing, grouped the way the UI will show it ===' AS section;
SELECT
    COALESCE(NULLIF(TRIM(category), ''), '(uncategorized)') AS will_map_to_category,
    item_code,
    component_name,
    quantity,
    unit_price,
    status
FROM components
ORDER BY will_map_to_category ASC, LENGTH(item_code) ASC, item_code ASC;

SELECT '=== 7. Totals to re-check after migration (must not change) ===' AS section;
SELECT
    COUNT(*)                                                              AS total_components,
    SUM(status <> 'ARCHIVED')                                             AS non_archived,
    COALESCE(SUM(CASE WHEN status <> 'ARCHIVED' THEN quantity END), 0)    AS total_stock,
    COALESCE(SUM(CASE WHEN status <> 'ARCHIVED' AND unit_price IS NOT NULL
                      THEN quantity * unit_price END), 0)                 AS total_stock_value,
    (SELECT COUNT(*) FROM inventory_transactions)                         AS transactions
FROM components;
