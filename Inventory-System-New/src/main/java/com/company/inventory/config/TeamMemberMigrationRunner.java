package com.company.inventory.config;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import lombok.extern.slf4j.Slf4j;

/**
 * Turns the free-text project staffing already in the database into rows in
 * {@code team_members}, and links every project it can match.
 *
 * <p>Nothing here deletes or rewrites a project. Projects keep their id, name, dates,
 * status, budget and — importantly — their original {@code project_manager} and
 * {@code team_members} text. The migration only fills columns that were previously empty:
 * the {@code project_manager_id} link and the {@code project_team_members} join rows. If
 * every link were removed tomorrow, the projects would still display exactly as they do
 * today, because the strings are still there.</p>
 *
 * <p>The roster is <em>derived from the data</em>: whatever names the existing projects
 * actually contain are the members that get created. Nothing is invented and no name is
 * hardcoded. A comma-separated roster is split in Java rather than SQL because MySQL has
 * no string-split function, and splitting in the application keeps the same trimming and
 * whitespace-collapsing rule the service layer uses.</p>
 *
 * <p>Every step is idempotent and re-runs cleanly on each boot:</p>
 * <ol>
 *   <li>Create a member for every distinct manager name and every distinct roster entry
 *       that does not already exist, matched case-insensitively so "A. Patil" and
 *       "a. patil" converge on one row.</li>
 *   <li>Point each project's {@code project_manager_id} at the member whose name matches
 *       its manager text — only where the link is still empty, so a manager reassigned
 *       since is never overwritten.</li>
 *   <li>Insert the join rows for each project's roster, skipping any pair that already
 *       exists.</li>
 * </ol>
 *
 * <p>Runs at {@code @Order(16)}: after the component category migration (15) so the two
 * never interleave their schema reads, and before the item-code backfill (20).</p>
 */
@Slf4j
@Component
@Order(16)
public class TeamMemberMigrationRunner implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    public TeamMemberMigrationRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public void run(String... args) {
        try {
            if (!tableExists("team_members") || !tableExists("projects")) {
                log.debug("Team member migration skipped: expected tables are not present yet.");
                return;
            }

            // Rows that predate the column read as NULL; they are active members.
            if (columnExists("team_members", "active")) {
                int defaulted = jdbcTemplate.update(
                        "UPDATE team_members SET active = TRUE WHERE active IS NULL");
                if (defaulted > 0) {
                    log.info("Marked {} existing team member(s) as active.", defaulted);
                }
            }

            int created = importManagers() + importRosters();
            if (created > 0) {
                log.info("Created {} team member(s) from existing project data.", created);
            }

            linkManagers();
            linkRosters();
            logSummary();
        } catch (Exception ex) {
            // A failure here must not stop the application. Projects are untouched and
            // still render from their original text, so startup continues and the problem
            // is visible in the log rather than as a boot loop on a production server.
            log.error("Team member migration did not complete. Projects are unchanged; "
                    + "check the error, fix the cause, and restart to retry.", ex);
        }
    }

    /** One member per distinct non-blank {@code projects.project_manager}. */
    private int importManagers() {
        if (!columnExists("projects", "project_manager")) {
            return 0;
        }
        List<String> names = jdbcTemplate.queryForList(
                "SELECT DISTINCT TRIM(project_manager) FROM projects "
                        + "WHERE project_manager IS NOT NULL AND TRIM(project_manager) <> ''",
                String.class);

        int created = 0;
        for (String name : names) {
            created += insertMemberIfAbsent(name);
        }
        return created;
    }

    /** One member per distinct name found inside the comma-separated rosters. */
    private int importRosters() {
        if (!columnExists("projects", "team_members")) {
            return 0;
        }
        List<String> rosters = jdbcTemplate.queryForList(
                "SELECT team_members FROM projects "
                        + "WHERE team_members IS NOT NULL AND TRIM(team_members) <> ''",
                String.class);

        Set<String> distinct = new LinkedHashSet<>();
        for (String roster : rosters) {
            distinct.addAll(splitRoster(roster));
        }

        int created = 0;
        for (String name : distinct) {
            created += insertMemberIfAbsent(name);
        }
        return created;
    }

    /**
     * Fills {@code project_manager_id} from the manager text.
     *
     * <p>Only rows where the link is still NULL are touched, so a project whose manager
     * has been reassigned through the new dropdown is never dragged back to whatever its
     * legacy text says.</p>
     */
    private void linkManagers() {
        if (!columnExists("projects", "project_manager_id") || !columnExists("projects", "project_manager")) {
            return;
        }
        int linked = jdbcTemplate.update(
                "UPDATE projects p "
                        + "JOIN team_members tm ON LOWER(TRIM(p.project_manager)) = LOWER(tm.name) "
                        + "SET p.project_manager_id = tm.id "
                        + "WHERE p.project_manager_id IS NULL "
                        + "  AND p.project_manager IS NOT NULL AND TRIM(p.project_manager) <> ''");
        if (linked > 0) {
            log.info("Linked {} project(s) to their manager.", linked);
        }
    }

    /**
     * Recreates each project's roster as join rows.
     *
     * <p>The insert carries its own NOT EXISTS check, so re-running adds nothing and two
     * instances starting together cannot both insert the same pair.</p>
     */
    private void linkRosters() {
        if (!tableExists("project_team_members") || !columnExists("projects", "team_members")) {
            return;
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT id, team_members FROM projects "
                        + "WHERE team_members IS NOT NULL AND TRIM(team_members) <> ''");

        int linked = 0;
        for (Map<String, Object> row : rows) {
            Long projectId = ((Number) row.get("id")).longValue();
            for (String name : splitRoster((String) row.get("team_members"))) {
                linked += jdbcTemplate.update(
                        "INSERT INTO project_team_members (project_id, team_member_id) "
                                + "SELECT ?, tm.id FROM team_members tm "
                                + "WHERE LOWER(tm.name) = LOWER(?) "
                                + "  AND NOT EXISTS (SELECT 1 FROM project_team_members ptm "
                                + "                  WHERE ptm.project_id = ? AND ptm.team_member_id = tm.id)",
                        projectId, name, projectId);
            }
        }
        if (linked > 0) {
            log.info("Linked {} project-to-member assignment(s).", linked);
        }
    }

    /**
     * Inserts a member unless an equal-ignoring-case name already exists.
     *
     * @return 1 when a row was created, 0 when one already existed
     */
    private int insertMemberIfAbsent(String name) {
        String cleaned = normalise(name);
        if (cleaned.isEmpty()) {
            return 0;
        }
        // The WHERE NOT EXISTS makes the insert itself the duplicate check, so two
        // instances starting together cannot both pass a separate "does it exist?"
        // query and then both insert. The unique index is the final backstop.
        return jdbcTemplate.update(
                "INSERT INTO team_members (name, active, created_at, updated_at) "
                        + "SELECT ?, TRUE, NOW(), NOW() FROM DUAL "
                        + "WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE LOWER(name) = LOWER(?))",
                cleaned, cleaned);
    }

    /** Splits a comma-separated roster, applying the same cleaning rule as the service. */
    private List<String> splitRoster(String roster) {
        List<String> names = new ArrayList<>();
        if (roster == null) {
            return names;
        }
        for (String part : roster.split(",")) {
            String cleaned = normalise(part);
            if (!cleaned.isEmpty()) {
                names.add(cleaned);
            }
        }
        return names;
    }

    private String normalise(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    /** One line, so the result of the migration is visible in the boot log. */
    private void logSummary() {
        Integer members = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM team_members", Integer.class);
        Integer assignments = tableExists("project_team_members")
                ? jdbcTemplate.queryForObject("SELECT COUNT(*) FROM project_team_members", Integer.class)
                : 0;
        log.info("Team members: {} on roster, {} project assignment(s).", members, assignments);
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
