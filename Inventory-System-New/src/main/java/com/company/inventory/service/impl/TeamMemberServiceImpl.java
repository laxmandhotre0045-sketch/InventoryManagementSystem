package com.company.inventory.service.impl;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.request.TeamMemberRequest;
import com.company.inventory.dto.response.TeamMemberResponse;
import com.company.inventory.entity.TeamMember;
import com.company.inventory.exception.ResourceInUseException;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.mapper.TeamMemberMapper;
import com.company.inventory.repository.ProjectRepository;
import com.company.inventory.repository.TeamMemberRepository;
import com.company.inventory.service.TeamMemberService;

/**
 * The roster behind the project manager and team dropdowns.
 *
 * <p>Mirrors {@link ComponentCategoryServiceImpl} deliberately: same duplicate rule
 * (case-insensitive check first, unique index as the backstop), same delete guard
 * (refuse while rows still reference it), same exception types — so the two admin-managed
 * catalogues behave identically from the UI's point of view.</p>
 */
@Service
@Transactional
public class TeamMemberServiceImpl implements TeamMemberService {

    private final TeamMemberRepository memberRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberMapper memberMapper;

    public TeamMemberServiceImpl(TeamMemberRepository memberRepository,
                                 ProjectRepository projectRepository,
                                 TeamMemberMapper memberMapper) {
        this.memberRepository = memberRepository;
        this.projectRepository = projectRepository;
        this.memberMapper = memberMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeamMemberResponse> getAllMembers() {
        return memberRepository.findAllByOrderByNameAsc().stream()
                .map(member -> memberMapper.toResponse(member,
                        projectRepository.countProjectsForMember(member.getId())))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeamMemberResponse> getActiveMembers() {
        // No project count here: this feeds the staffing dropdowns, which render a name
        // and a designation, and asking for a count per member would add one query per
        // option every time the project dialog opens.
        return memberRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(member -> memberMapper.toResponse(member, null))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public TeamMemberResponse getMemberById(Long id) {
        TeamMember member = requireById(id);
        return memberMapper.toResponse(member, projectRepository.countProjectsForMember(id));
    }

    @Override
    public TeamMemberResponse createMember(TeamMemberRequest request) {
        TeamMember entity = memberMapper.toEntity(request);
        if (memberRepository.existsByNameIgnoreCase(entity.getName())) {
            throw new IllegalArgumentException(
                    "A team member named '" + entity.getName() + "' already exists");
        }
        TeamMember saved = memberRepository.save(entity);
        return memberMapper.toResponse(saved, 0L);
    }

    @Override
    public TeamMemberResponse updateMember(Long id, TeamMemberRequest request) {
        TeamMember existing = requireById(id);
        memberMapper.updateEntity(request, existing);

        // A rename that only changes capitalisation is still the same person, so compare
        // against the row being edited before rejecting the name as taken.
        memberRepository.findByNameIgnoreCase(existing.getName())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new IllegalArgumentException(
                            "A team member named '" + existing.getName() + "' already exists");
                });

        TeamMember updated = memberRepository.save(existing);
        return memberMapper.toResponse(updated, projectRepository.countProjectsForMember(id));
    }

    @Override
    public void deleteMember(Long id) {
        TeamMember existing = requireById(id);

        // Refusing here is what protects project history. Removing a staffed member would
        // either fail on the join-table constraint or silently empty a project's team, so
        // the message points at the fix: deactivate instead, which keeps every existing
        // assignment intact and only removes the person from future dropdowns.
        long inUse = projectRepository.countProjectsForMember(id);
        if (inUse > 0) {
            throw new ResourceInUseException("Cannot delete '" + existing.getName() + "': assigned to "
                    + inUse + " project(s). Deactivate them instead to keep those assignments.");
        }
        memberRepository.delete(existing);
    }

    @Override
    @Transactional(readOnly = true)
    public TeamMember requireById(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("Team member is required");
        }
        return memberRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team member not found with id: " + id));
    }

    @Override
    @Transactional(readOnly = true)
    public Set<TeamMember> resolveAll(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return new LinkedHashSet<>();
        }
        // Distinct ids, one query. Comparing counts catches an id that no longer exists —
        // better a clear error than a project quietly saved with a member missing.
        Set<Long> wanted = new LinkedHashSet<>(ids);
        wanted.remove(null);
        if (wanted.isEmpty()) {
            return new LinkedHashSet<>();
        }

        List<TeamMember> found = memberRepository.findAllById(wanted);
        if (found.size() != wanted.size()) {
            Set<Long> resolved = found.stream().map(TeamMember::getId).collect(Collectors.toSet());
            wanted.removeAll(resolved);
            throw new ResourceNotFoundException("Team member not found with id: " + wanted.iterator().next());
        }
        return new LinkedHashSet<>(found);
    }
}
