package com.company.inventory.library.service;

import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.library.dto.request.MemberRequest;
import com.company.inventory.library.dto.response.BookIssueResponse;
import com.company.inventory.library.dto.response.MemberResponse;

public interface MemberService {

    MemberResponse create(MemberRequest request);

    MemberResponse update(Long id, MemberRequest request);

    MemberResponse getById(Long id);

    void delete(Long id);

    PagedResponse<MemberResponse> search(String keyword, int page, int size, String sortBy, String sortDir);

    /** Full borrowing history (issued + returned) for one member. */
    PagedResponse<BookIssueResponse> borrowingHistory(Long memberId, int page, int size);
}
