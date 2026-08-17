package com.company.inventory.dto.request;

import com.company.inventory.entity.ProjectPriority;
import com.company.inventory.entity.ProjectStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class ProjectRequest {

    @Schema(description = "Project name", example = "Vibration Monitoring System")
    @NotBlank(message = "Project name is required")
    @Size(max = 150, message = "Project name must be at most 150 characters")
    private String projectName;

    @Schema(description = "Project description", example = "Monitoring vibration levels for industrial equipment")
    @Size(max = 1000, message = "Description must be at most 1000 characters")
    private String description;

    /**
     * Free-text manager name.
     *
     * <p>Still accepted so existing API clients keep working unchanged. When
     * {@link #projectManagerId} is supplied the server derives this string from the
     * selected member instead and ignores whatever was sent here — one field has to win,
     * and the one backed by a real row is the one that can be trusted.</p>
     */
    @Schema(description = "Project manager name — ignored when projectManagerId is supplied",
            example = "R. Deshmukh")
    @Size(max = 120, message = "Project manager must be at most 120 characters")
    private String projectManager;

    /**
     * The manager, chosen from the roster Settings maintains. Optional: omitting it leaves
     * the project with only its legacy text, which is how projects created before the
     * dropdown existed continue to behave.
     */
    @Schema(description = "Id of a team member to assign as project manager", example = "1")
    private Long projectManagerId;

    @Schema(description = "Project start date")
    private LocalDate startDate;

    @Schema(description = "Project end date")
    private LocalDate endDate;

    @Schema(description = "Project status", example = "ACTIVE")
    @NotNull(message = "Project status is required")
    private ProjectStatus status;

    /**
     * Comma-separated roster. Same rule as {@link #projectManager}: still accepted for
     * existing clients, but superseded by {@link #teamMemberIds} when that is supplied.
     */
    @Schema(description = "Comma-separated team member names — ignored when teamMemberIds is supplied",
            example = "A. Patil, S. Kulkarni")
    @Size(max = 500, message = "Team members must be at most 500 characters")
    private String teamMembers;

    /**
     * The assigned team, chosen from the roster Settings maintains.
     *
     * <p>A null list means "not supplied" and leaves the existing roster untouched, so a
     * client that never sends the field cannot wipe a project's team. An empty list is a
     * deliberate instruction to clear it.</p>
     */
    @Schema(description = "Ids of team members assigned to this project", example = "[2, 5]")
    private List<Long> teamMemberIds;

    @Schema(description = "Project priority", example = "HIGH")
    private ProjectPriority priority;

    @Schema(description = "Allocated budget", example = "250000.00")
    @PositiveOrZero(message = "Budget cannot be negative")
    private BigDecimal budget;
}
