package com.company.inventory.mapper;

import org.springframework.stereotype.Component;

import com.company.inventory.dto.request.TeamMemberRequest;
import com.company.inventory.dto.response.TeamMemberResponse;
import com.company.inventory.entity.TeamMember;

@Component
public class TeamMemberMapper {

    public TeamMember toEntity(TeamMemberRequest request) {
        if (request == null) {
            return null;
        }
        return TeamMember.builder()
                .name(normalise(request.getName()))
                .designation(trimToNull(request.getDesignation()))
                .email(trimToNull(request.getEmail()))
                .phone(trimToNull(request.getPhone()))
                // Null is fine: @PrePersist defaults a new member to active.
                .active(request.getActive())
                .build();
    }

    /**
     * @param projectCount how many projects reference this member; null when the caller
     *                     has not computed it (single-record reads that do not need it)
     */
    public TeamMemberResponse toResponse(TeamMember member, Long projectCount) {
        if (member == null) {
            return null;
        }
        TeamMemberResponse response = new TeamMemberResponse();
        response.setId(member.getId());
        response.setName(member.getName());
        response.setDesignation(member.getDesignation());
        response.setEmail(member.getEmail());
        response.setPhone(member.getPhone());
        // Rows created before the column existed read as null; they are active.
        response.setActive(member.getActive() == null || member.getActive());
        response.setProjectCount(projectCount);
        response.setCreatedAt(member.getCreatedAt());
        response.setUpdatedAt(member.getUpdatedAt());
        return response;
    }

    public void updateEntity(TeamMemberRequest request, TeamMember member) {
        if (request == null || member == null) {
            return;
        }
        member.setName(normalise(request.getName()));
        member.setDesignation(trimToNull(request.getDesignation()));
        member.setEmail(trimToNull(request.getEmail()));
        member.setPhone(trimToNull(request.getPhone()));
        // Only overwrite when supplied, so a client that omits the flag cannot silently
        // reactivate someone who was deliberately retired.
        if (request.getActive() != null) {
            member.setActive(request.getActive());
        }
    }

    /** Collapses internal whitespace so "A.  Patil" and "A. Patil" cannot both exist. */
    private String normalise(String value) {
        return value == null ? null : value.trim().replaceAll("\\s+", " ");
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
