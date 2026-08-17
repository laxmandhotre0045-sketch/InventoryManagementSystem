package com.company.inventory.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.Set;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "projects")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_name", nullable = false, length = 150)
    private String projectName;

    @Column(columnDefinition = "TEXT")
    private String description;

    /**
     * Person accountable for the project, as a plain name.
     *
     * <p>Kept, and kept populated, even though {@link #projectManagerMember} is now the
     * real link. Every existing reader — the projects table's Manager column, the details
     * drawer, any saved export — reads this string, so the service rewrites it from the
     * selected member on every save. Projects created before the dropdown existed keep
     * their original text and display exactly as they did.</p>
     */
    @Column(name = "project_manager", length = 120)
    private String projectManager;

    /**
     * Comma-separated roster, maintained for the same backward-compatibility reason as
     * {@link #projectManager}: the details drawer splits this string to render its team
     * chips. {@link #assignedMembers} is the authoritative list; this is its rendering.
     */
    @Column(name = "team_members", length = 500)
    private String teamMembers;

    /**
     * The manager as a row in {@code team_members} — what makes "which projects does this
     * person run?" answerable, and what stops three spellings of one name existing.
     *
     * <p>Nullable on purpose: projects created before this column existed have only the
     * legacy string and must keep loading. The migration backfills every link it can match
     * by name; anything unmatched keeps its text and no link.</p>
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_manager_id",
            foreignKey = @ForeignKey(name = "fk_projects_manager"))
    private TeamMember projectManagerMember;

    /**
     * The assigned team, as real rows rather than parsed text.
     *
     * <p>Fetched lazily and read inside the service's transaction. An eager collection
     * would add one select per project on the list screen — ten per page — to produce data
     * that screen already renders from {@link #teamMembers}.</p>
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "project_team_members",
            joinColumns = @JoinColumn(name = "project_id",
                    foreignKey = @ForeignKey(name = "fk_project_team_members_project")),
            inverseJoinColumns = @JoinColumn(name = "team_member_id",
                    foreignKey = @ForeignKey(name = "fk_project_team_members_member")))
    @Builder.Default
    private Set<TeamMember> assignedMembers = new LinkedHashSet<>();

    private LocalDate startDate;
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ProjectStatus status;

    /** Nullable so rows created before this column existed keep loading. */
    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private ProjectPriority priority;

    @Column(precision = 15, scale = 2)
    private java.math.BigDecimal budget;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
