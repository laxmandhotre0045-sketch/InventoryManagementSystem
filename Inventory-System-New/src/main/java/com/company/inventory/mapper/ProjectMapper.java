package com.company.inventory.mapper;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import com.company.inventory.dto.request.ProjectRequest;
import com.company.inventory.dto.response.ProjectResponse;
import com.company.inventory.entity.Project;
import com.company.inventory.entity.ProjectStatus;
import com.company.inventory.entity.TeamMember;
import org.springframework.stereotype.Component;

/**
 * Translation only. As in {@link ComponentMapper}, the team members arrive already
 * resolved rather than as ids, so the "does this member exist?" decision stays in the
 * service with the rest of the validation.
 *
 * <p>Both staffing fields are written twice on purpose — once as the relation, once as the
 * legacy string. The string is what every current reader displays, so keeping it in step
 * here is what let this change land without editing a single existing screen.</p>
 */
@Component
public class ProjectMapper {

    public Project toEntity(ProjectRequest request, TeamMember manager, Set<TeamMember> members) {
        if (request == null) {
            return null;
        }

        Set<TeamMember> assigned = members == null ? new LinkedHashSet<>() : new LinkedHashSet<>(members);

        return Project.builder()
                .projectName(request.getProjectName())
                .description(request.getDescription())
                .projectManager(manager != null ? manager.getName() : request.getProjectManager())
                .projectManagerMember(manager)
                .teamMembers(resolveTeamText(request, members))
                .assignedMembers(assigned)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .status(request.getStatus() != null ? request.getStatus() : ProjectStatus.ACTIVE)
                .priority(request.getPriority())
                .budget(request.getBudget())
                .build();
    }

    public ProjectResponse toResponse(Project project) {
        if (project == null) {
            return null;
        }

        ProjectResponse response = new ProjectResponse();
        response.setId(project.getId());
        response.setProjectName(project.getProjectName());
        response.setDescription(project.getDescription());
        response.setProjectManager(project.getProjectManager());
        if (project.getProjectManagerMember() != null) {
            response.setProjectManagerId(project.getProjectManagerMember().getId());
        }
        response.setTeamMembers(project.getTeamMembers());
        // Touches the lazy collection, which is why every caller of this mapper runs
        // inside the service's transaction.
        if (project.getAssignedMembers() != null && !project.getAssignedMembers().isEmpty()) {
            response.setTeamMemberIds(project.getAssignedMembers().stream()
                    .map(TeamMember::getId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList()));
        }
        response.setStartDate(project.getStartDate());
        response.setEndDate(project.getEndDate());
        response.setStatus(project.getStatus());
        response.setPriority(project.getPriority());
        response.setBudget(project.getBudget());
        response.setCreatedAt(project.getCreatedAt());
        response.setUpdatedAt(project.getUpdatedAt());
        return response;
    }

    /**
     * @param members null when the client did not send the field at all, which must leave
     *                the existing roster alone; an empty set is a deliberate "clear it"
     */
    public void updateEntity(ProjectRequest request, Project existing,
                             TeamMember manager, Set<TeamMember> members) {
        if (request == null || existing == null) {
            return;
        }

        existing.setProjectName(request.getProjectName());
        existing.setDescription(request.getDescription());
        existing.setStartDate(request.getStartDate());
        existing.setEndDate(request.getEndDate());
        existing.setStatus(request.getStatus() != null ? request.getStatus() : ProjectStatus.ACTIVE);
        existing.setPriority(request.getPriority());
        existing.setBudget(request.getBudget());

        // The manager link is only rewritten when an id was supplied. Without this guard an
        // older client sending just the name would silently unlink a manager chosen in the UI.
        if (request.getProjectManagerId() != null) {
            existing.setProjectManagerMember(manager);
            existing.setProjectManager(manager != null ? manager.getName() : null);
        } else {
            existing.setProjectManager(request.getProjectManager());
        }

        if (members != null) {
            // Mutate the managed collection rather than replacing it, so Hibernate diffs
            // the join table instead of deleting and reinserting every row.
            existing.getAssignedMembers().clear();
            existing.getAssignedMembers().addAll(members);
            existing.setTeamMembers(joinNames(members));
        } else if (request.getTeamMembers() != null) {
            existing.setTeamMembers(request.getTeamMembers());
        }
    }

    private String resolveTeamText(ProjectRequest request, Set<TeamMember> members) {
        if (members == null) {
            return request.getTeamMembers();
        }
        return joinNames(members);
    }

    /** Sorted, so the stored string is stable regardless of the order the ids arrived in. */
    private String joinNames(Set<TeamMember> members) {
        if (members == null || members.isEmpty()) {
            return null;
        }
        List<String> names = members.stream()
                .map(TeamMember::getName)
                .filter(Objects::nonNull)
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .collect(Collectors.toList());
        return names.isEmpty() ? null : String.join(", ", names);
    }
}
