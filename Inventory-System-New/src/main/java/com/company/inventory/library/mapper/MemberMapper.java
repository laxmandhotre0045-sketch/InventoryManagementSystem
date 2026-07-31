package com.company.inventory.library.mapper;

import org.springframework.stereotype.Component;

import com.company.inventory.library.dto.request.MemberRequest;
import com.company.inventory.library.dto.response.MemberResponse;
import com.company.inventory.library.entity.Member;

/** Maps between {@link Member} entities and their DTOs. */
@Component
public class MemberMapper {

    public MemberResponse toResponse(Member member, long activeIssues) {
        return MemberResponse.builder()
                .id(member.getId())
                .employeeId(member.getEmployeeId())
                .name(member.getName())
                .department(member.getDepartment())
                .email(member.getEmail())
                .phone(member.getPhone())
                .activeIssues(activeIssues)
                .createdAt(member.getCreatedAt())
                .updatedAt(member.getUpdatedAt())
                .build();
    }

    public void applyEditableFields(MemberRequest request, Member member) {
        member.setEmployeeId(request.getEmployeeId() != null ? request.getEmployeeId().trim() : null);
        member.setName(request.getName() != null ? request.getName().trim() : null);
        member.setDepartment(trim(request.getDepartment()));
        member.setEmail(trim(request.getEmail()));
        member.setPhone(trim(request.getPhone()));
    }

    private String trim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
