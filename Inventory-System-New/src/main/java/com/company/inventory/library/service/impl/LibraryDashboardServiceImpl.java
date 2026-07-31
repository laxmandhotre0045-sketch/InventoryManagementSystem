package com.company.inventory.library.service.impl;

import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.company.inventory.library.dto.response.BookIssueResponse;
import com.company.inventory.library.dto.response.LibraryDashboardResponse;
import com.company.inventory.library.entity.IssueStatus;
import com.company.inventory.library.mapper.BookIssueMapper;
import com.company.inventory.library.repository.BookIssueRepository;
import com.company.inventory.library.repository.BookRepository;
import com.company.inventory.library.repository.MemberRepository;
import com.company.inventory.library.service.LibraryDashboardService;

@Service
@Transactional(readOnly = true)
public class LibraryDashboardServiceImpl implements LibraryDashboardService {

    private final BookRepository bookRepository;
    private final MemberRepository memberRepository;
    private final BookIssueRepository bookIssueRepository;
    private final BookIssueMapper bookIssueMapper;

    public LibraryDashboardServiceImpl(BookRepository bookRepository,
                                       MemberRepository memberRepository,
                                       BookIssueRepository bookIssueRepository,
                                       BookIssueMapper bookIssueMapper) {
        this.bookRepository = bookRepository;
        this.memberRepository = memberRepository;
        this.bookIssueRepository = bookIssueRepository;
        this.bookIssueMapper = bookIssueMapper;
    }

    @Override
    public LibraryDashboardResponse getDashboard() {
        LocalDate today = LocalDate.now();

        long totalBooks = bookRepository.count();
        long totalCopies = bookRepository.sumTotalCopies();
        long availableCopies = bookRepository.sumAvailableCopies();
        long issuedCount = bookIssueRepository.countByStatus(IssueStatus.ISSUED);
        long overdue = bookIssueRepository.countOverdue(today);
        long activeMembers = memberRepository.count();

        List<BookIssueResponse> recentlyIssued = bookIssueRepository
                .findTop5ByOrderByIssueDateDescIdDesc().stream()
                .map(i -> bookIssueMapper.toResponse(i, today)).toList();
        List<BookIssueResponse> recentlyReturned = bookIssueRepository
                .findTop5ByReturnDateIsNotNullOrderByReturnDateDescIdDesc().stream()
                .map(i -> bookIssueMapper.toResponse(i, today)).toList();

        List<LibraryDashboardResponse.CategoryCount> byCategory = buildCategoryCounts();

        return LibraryDashboardResponse.builder()
                .totalBooks(totalBooks)
                .totalCopies(totalCopies)
                .availableBooks(availableCopies)
                .issuedBooks(issuedCount)
                .overdueBooks(overdue)
                .activeMembers(activeMembers)
                .recentlyIssued(recentlyIssued)
                .recentlyReturned(recentlyReturned)
                .booksByCategory(byCategory)
                .build();
    }

    private List<LibraryDashboardResponse.CategoryCount> buildCategoryCounts() {
        return bookRepository.findAll().stream()
                .collect(java.util.stream.Collectors.groupingBy(
                        b -> (b.getCategory() == null || b.getCategory().isBlank()) ? "Uncategorized" : b.getCategory(),
                        java.util.stream.Collectors.counting()))
                .entrySet().stream()
                .map(e -> LibraryDashboardResponse.CategoryCount.builder()
                        .category(e.getKey()).count(e.getValue()).build())
                .sorted((a, b) -> Long.compare(b.getCount(), a.getCount()))
                .toList();
    }
}
