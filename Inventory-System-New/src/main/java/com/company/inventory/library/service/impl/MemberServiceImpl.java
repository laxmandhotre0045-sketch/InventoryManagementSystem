package com.company.inventory.library.service.impl;

import java.time.LocalDate;

import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.exception.ResourceInUseException;
import com.company.inventory.exception.ResourceNotFoundException;
import com.company.inventory.library.dto.request.MemberRequest;
import com.company.inventory.library.dto.response.BookIssueResponse;
import com.company.inventory.library.dto.response.MemberResponse;
import com.company.inventory.library.entity.IssueStatus;
import com.company.inventory.library.entity.Member;
import com.company.inventory.library.mapper.BookIssueMapper;
import com.company.inventory.library.mapper.MemberMapper;
import com.company.inventory.library.repository.BookIssueRepository;
import com.company.inventory.library.repository.MemberRepository;
import com.company.inventory.library.service.MemberService;

@Service
@Transactional
public class MemberServiceImpl implements MemberService {

    private final MemberRepository memberRepository;
    private final BookIssueRepository bookIssueRepository;
    private final MemberMapper memberMapper;
    private final BookIssueMapper bookIssueMapper;

    public MemberServiceImpl(MemberRepository memberRepository,
                             BookIssueRepository bookIssueRepository,
                             MemberMapper memberMapper,
                             BookIssueMapper bookIssueMapper) {
        this.memberRepository = memberRepository;
        this.bookIssueRepository = bookIssueRepository;
        this.memberMapper = memberMapper;
        this.bookIssueMapper = bookIssueMapper;
    }

    @Override
    public MemberResponse create(MemberRequest request) {
        String employeeId = request.getEmployeeId().trim();
        if (memberRepository.existsByEmployeeIdIgnoreCase(employeeId)) {
            throw new IllegalArgumentException("A member with Employee ID '" + employeeId + "' already exists");
        }
        Member member = new Member();
        memberMapper.applyEditableFields(request, member);
        Member saved = memberRepository.save(member);
        return memberMapper.toResponse(saved, 0L);
    }

    @Override
    public MemberResponse update(Long id, MemberRequest request) {
        Member member = findMember(id);
        String employeeId = request.getEmployeeId().trim();
        if (memberRepository.existsByEmployeeIdIgnoreCaseAndIdNot(employeeId, id)) {
            throw new IllegalArgumentException("A member with Employee ID '" + employeeId + "' already exists");
        }
        memberMapper.applyEditableFields(request, member);
        Member saved = memberRepository.save(member);
        return memberMapper.toResponse(saved, activeIssues(id));
    }

    @Override
    @Transactional(readOnly = true)
    public MemberResponse getById(Long id) {
        Member member = findMember(id);
        return memberMapper.toResponse(member, activeIssues(id));
    }

    @Override
    public void delete(Long id) {
        Member member = findMember(id);
        if (bookIssueRepository.existsByMemberIdAndStatus(id, IssueStatus.ISSUED)) {
            throw new ResourceInUseException(
                    "Cannot delete '" + member.getName() + "' while they still hold issued books");
        }
        memberRepository.delete(member);
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<MemberResponse> search(String keyword, int page, int size, String sortBy, String sortDir) {
        Page<Member> result = memberRepository.search(
                emptyToNull(keyword),
                LibrarySupport.pageable(page, size, sortBy, sortDir, "name"));
        return LibrarySupport.toPaged(result,
                m -> memberMapper.toResponse(m, activeIssues(m.getId())));
    }

    @Override
    @Transactional(readOnly = true)
    public PagedResponse<BookIssueResponse> borrowingHistory(Long memberId, int page, int size) {
        findMember(memberId); // 404 if the member does not exist
        LocalDate today = LocalDate.now();
        Page<com.company.inventory.library.entity.BookIssue> result = bookIssueRepository.findByMemberId(
                memberId, LibrarySupport.pageable(page, size, "issueDate", "desc", "issueDate"));
        return LibrarySupport.toPaged(result, issue -> bookIssueMapper.toResponse(issue, today));
    }

    private long activeIssues(Long memberId) {
        return bookIssueRepository.countByMemberIdAndStatus(memberId, IssueStatus.ISSUED);
    }

    private Member findMember(Long id) {
        return memberRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Member not found with id " + id));
    }

    private String emptyToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }
}
