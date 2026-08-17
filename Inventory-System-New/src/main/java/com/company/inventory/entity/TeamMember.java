package com.company.inventory.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A person who can be assigned to a project — as its manager, as a team member, or both.
 *
 * <p>Project staffing used to live as free text on the project itself: a
 * {@code project_manager} string and a comma-separated {@code team_members} string. That
 * let the same person exist as "A. Patil", "a patil" and "Patil, A." across three projects,
 * so no query could answer "what is this person working on". Members are now rows with
 * their own identity, chosen from a dropdown that Settings controls.</p>
 *
 * <p>Uniqueness on name is enforced by the index — the guarantee that holds even against
 * concurrent inserts — while the service performs a case-insensitive lookup first so a
 * duplicate returns a readable message instead of a constraint violation. This mirrors
 * exactly how {@link ComponentCategory} handles the same problem.</p>
 *
 * <p>Deactivating rather than deleting is the intended way to retire someone. A member who
 * has left still needs to appear on the historical projects they worked on, so
 * {@code active} controls only whether they are offered in the assignment dropdowns.</p>
 */
@Entity
@Table(name = "team_members", indexes = {
        @Index(name = "idx_team_members_name", columnList = "name", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TeamMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String name;

    /** Job title shown beside the name in the assignment dropdowns, e.g. "Design Engineer". */
    @Column(length = 120)
    private String designation;

    @Column(length = 150)
    private String email;

    @Column(length = 30)
    private String phone;

    /**
     * Whether this person is offered when staffing a project.
     *
     * <p>Nullable at DDL level only so the column can be added to a table that already has
     * rows; {@link #prePersist()} defaults it to true and the migration backfills existing
     * rows, so it is never read as null.</p>
     */
    @Column(name = "active")
    private Boolean active;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
        if (active == null) {
            active = Boolean.TRUE;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
