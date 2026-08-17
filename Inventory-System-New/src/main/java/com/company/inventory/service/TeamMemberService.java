package com.company.inventory.service;

import java.util.Collection;
import java.util.List;
import java.util.Set;

import com.company.inventory.dto.request.TeamMemberRequest;
import com.company.inventory.dto.response.TeamMemberResponse;
import com.company.inventory.entity.TeamMember;

public interface TeamMemberService {

    List<TeamMemberResponse> getAllMembers();

    /** Only members still offered for staffing — what the project dropdowns load. */
    List<TeamMemberResponse> getActiveMembers();

    TeamMemberResponse getMemberById(Long id);

    TeamMemberResponse createMember(TeamMemberRequest request);

    TeamMemberResponse updateMember(Long id, TeamMemberRequest request);

    void deleteMember(Long id);

    /** Resolves an id to a member, or throws — used when staffing a project. */
    TeamMember requireById(Long id);

    /**
     * Resolves a set of ids in one query, preserving nothing about order (the caller
     * sorts by name when rendering). Throws if any id does not exist, so a project can
     * never be saved referencing a member that was deleted mid-edit.
     */
    Set<TeamMember> resolveAll(Collection<Long> ids);
}
