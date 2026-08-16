package com.company.inventory.config;

import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;

/**
 * Moves components from a free-text category column onto the {@code component_categories}
 * foreign key, without touching a single component row's identity.
 *
 * <p>Nothing here deletes or recreates data. Existing components keep their id, item code,
 * name, quantity, price and history; the migration only fills in a column that was
 * previously empty. The category names themselves are <em>derived from the data</em> — the
 * distinct values already sitting in {@code components.category} — so whatever the existing
 * resistor rows actually say is what they end up mapped to. Nothing is guessed, and no
 * mapping is hardcoded to particular component names.</p>
 *
 * <p>Every step is idempotent and re-runs cleanly on every boot:</p>
 * <ol>
 *   <li>Seed a starter catalogue, but <em>only</em> when the table is completely empty.
 *       On a database that has been running, deleting a category is a decision that
 *       sticks — this never resurrects one.</li>
 *   <li>Create a category for every distinct legacy value not already present, matched
 *       case-insensitively so "resistor" and "Resistor" converge on one row.</li>
 *   <li>Point each component at the category matching its legacy text.</li>
 *   <li>Give anything still unlinked the "Uncategorized" category, so the grouped list
 *       and the category filter can account for every component.</li>
 * </ol>
 *
 * <p>Runs at {@code @Order(15)}: after DataInitializer's schema migrations (10) and before
 * ItemCodeBackfillRunner (20), which loads ComponentItem entities. Doing it in that gap
 * means no component is ever read through JPA while its category link is still missing.</p>
 *
 * <p>The legacy {@code components.category} column is deliberately left in place. It is
 * this migration's only input, so keeping it means the work can be verified — or repeated
 * after a restore — long after the fact. Hibernate no longer maps it, so it costs nothing
 * but the disk it already occupied.</p>
 */
@Slf4j
@Component
@Order(15)
public class ComponentCategoryMigrationRunner implements CommandLineRunner {

    /**
     * Starter catalogue for a brand-new database, so the category dropdown is never empty
     * on first use. Applied only when no categories exist at all.
     */
    private static final List<String> STARTER_CATEGORIES = List.of(
            "Resistor", "Capacitor", "IC", "Diode", "Transistor",
            "Inductor", "Connector", "Sensor", "Microcontroller", "Module", "Other");

    private static final String UNCATEGORIZED = "Uncategorized";

    private final JdbcTemplate jdbcTemplate;

    public ComponentCategoryMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public void run(String... args) {
        try {
            if (!tableExists("component_categories") || !tableExists("components")) {
                log.debug("Category migration skipped: expected tables are not present yet.");
                return;
            }

            seedStarterCatalogueIfEmpty();

            boolean hasLegacyColumn = columnExists("components", "category");
            if (hasLegacyColumn) {
                importLegacyCategories();
                linkComponentsToLegacyCategories();
            } else {
                log.debug("No legacy components.category column — nothing to import.");
            }

            assignFallbackCategory();
            logSummary();
        } catch (Exception ex) {
            // A failure here must not stop the application: the components themselves are
            // untouched and still readable. Startup continues and the problem is visible
            // in the log rather than as a boot loop on a production server.
            log.error("Component category migration did not complete. Components are unchanged; "
                    + "check the error, fix the cause, and restart to retry.", ex);
        }
    }

    /**
     * Seeds the starter list only into a genuinely empty table.
     *
     * <p>The emptiness check is what makes this safe to leave enabled forever. On the
     * first boot after this feature ships the table is empty, so the catalogue lands and
     * the legacy import then matches "Resistor" to the seeded Resistor instead of making
     * a second one. On every later boot the table has rows, so this does nothing — and an
     * admin who deletes a category they do not want stays rid of it.</p>
     */
    private void seedStarterCatalogueIfEmpty() {
        Integer existing = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM component_categories", Integer.class);
        if (existing != null && existing > 0) {
            return;
        }
        for (String name : STARTER_CATEGORIES) {
            insertCategoryIfAbsent(name);
        }
        log.info("Seeded {} starter component categories.", STARTER_CATEGORIES.size());
    }

    /**
     * Creates a category row for every distinct value the legacy column holds.
     *
     * <p>This is the step that guarantees requirement-by-data rather than
     * requirement-by-assumption: if the existing rows say "Resistor", a Resistor category
     * is what gets created. Blank and NULL values are excluded — those become
     * "Uncategorized" later — and matching is case-insensitive on the trimmed value so
     * spelling variants collapse into one category instead of several.</p>
     */
    private void importLegacyCategories() {
        List<String> legacyNames = jdbcTemplate.queryForList(
                "SELECT DISTINCT TRIM(category) FROM components "
                        + "WHERE category IS NOT NULL AND TRIM(category) <> ''",
                String.class);

        int created = 0;
        for (String name : legacyNames) {
            created += insertCategoryIfAbsent(name);
        }
        if (created > 0) {
            log.info("Created {} component category/categories from existing component data.", created);
        }
    }

    /**
     * Links each component to the category whose name matches its legacy text.
     *
     * <p>Only rows whose {@code category_id} is still NULL are touched, so a component
     * that has already been categorised — by an earlier run, or by a user since — is
     * never reassigned. The join is on the trimmed, case-folded name, which is exactly
     * how the categories were created a step earlier, so every non-blank legacy value
     * finds its row.</p>
     */
    private void linkComponentsToLegacyCategories() {
        int linked = jdbcTemplate.update(
                "UPDATE components c "
                        + "JOIN component_categories cc ON LOWER(TRIM(c.category)) = LOWER(cc.name) "
                        + "SET c.category_id = cc.id "
                        + "WHERE c.category_id IS NULL "
                        + "  AND c.category IS NOT NULL AND TRIM(c.category) <> ''");
        if (linked > 0) {
            log.info("Linked {} existing component(s) to their category.", linked);
        }
    }

    /** Everything still unlinked — legacy value was blank, or predates the column. */
    private void assignFallbackCategory() {
        Integer remaining = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM components WHERE category_id IS NULL", Integer.class);
        if (remaining == null || remaining == 0) {
            return;
        }

        insertCategoryIfAbsent(UNCATEGORIZED);
        Long fallbackId = findCategoryId(UNCATEGORIZED);
        if (fallbackId == null) {
            log.warn("Could not resolve the '{}' category; {} component(s) remain unlinked.",
                    UNCATEGORIZED, remaining);
            return;
        }

        int updated = jdbcTemplate.update(
                "UPDATE components SET category_id = ? WHERE category_id IS NULL", fallbackId);
        log.info("Assigned '{}' to {} component(s) that had no category.", UNCATEGORIZED, updated);
    }

    /**
     * Inserts a category unless an equal-ignoring-case name already exists.
     *
     * @return 1 when a row was created, 0 when one already existed
     */
    private int insertCategoryIfAbsent(String name) {
        String cleaned = name == null ? "" : name.trim().replaceAll("\\s+", " ");
        if (cleaned.isEmpty()) {
            return 0;
        }
        // The WHERE NOT EXISTS makes the insert itself the duplicate check, so two
        // application instances starting together cannot both pass a separate
        // "does it exist?" query and then both insert. The unique index is the
        // final backstop if they interleave anyway.
        return jdbcTemplate.update(
                "INSERT INTO component_categories (name, created_at, updated_at) "
                        + "SELECT ?, NOW(), NOW() FROM DUAL "
                        + "WHERE NOT EXISTS (SELECT 1 FROM component_categories WHERE LOWER(name) = LOWER(?))",
                cleaned, cleaned);
    }

    private Long findCategoryId(String name) {
        List<Long> ids = jdbcTemplate.queryForList(
                "SELECT id FROM component_categories WHERE LOWER(name) = LOWER(?) LIMIT 1",
                Long.class, name);
        return ids.isEmpty() ? null : ids.get(0);
    }

    /** One line per category, so the result of the migration is visible in the boot log. */
    private void logSummary() {
        List<String> summary = jdbcTemplate.query(
                "SELECT cc.name, COUNT(c.id) AS n FROM component_categories cc "
                        + "LEFT JOIN components c ON c.category_id = cc.id "
                        + "GROUP BY cc.id, cc.name ORDER BY cc.name",
                (rs, rowNum) -> rs.getString("name") + "=" + rs.getInt("n"));
        if (!summary.isEmpty()) {
            log.info("Component categories: {}", String.join(", ", summary));
        }
    }

    private boolean tableExists(String table) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.TABLES "
                        + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
                Integer.class, table);
        return count != null && count > 0;
    }

    private boolean columnExists(String table, String column) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.COLUMNS "
                        + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
                Integer.class, table, column);
        return count != null && count > 0;
    }
}
