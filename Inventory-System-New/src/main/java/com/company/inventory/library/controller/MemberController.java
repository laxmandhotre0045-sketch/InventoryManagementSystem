package com.company.inventory.library.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.PagedResponse;
import com.company.inventory.library.dto.request.MemberRequest;
import com.company.inventory.library.dto.response.BookIssueResponse;
import com.company.inventory.library.dto.response.MemberResponse;
import com.company.inventory.library.service.MemberService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/library/members")
@Validated
@Tag(name = "Library — Members", description = "Manage library members and view borrowing history")
public class MemberController {

    private final MemberService memberService;

    public MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    @Operation(summary = "Create a member")
    @PostMapping
    public ResponseEntity<ApiResponse<MemberResponse>> create(@Valid @RequestBody MemberRequest request) {
        MemberResponse response = memberService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Member created successfully", response));
    }

    @Operation(summary = "Update a member")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MemberResponse>> update(@PathVariable Long id,
                                                              @Valid @RequestBody MemberRequest request) {
        MemberResponse response = memberService.update(id, request);
        return ResponseEntity.ok(ApiResponse.success("Member updated successfully", response));
    }

    @Operation(summary = "Get a member by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MemberResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Member retrieved successfully", memberService.getById(id)));
    }

    @Operation(summary = "Search / list members with pagination")
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<MemberResponse>>> search(
            @RequestParam(defaultValue = "") String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir) {
        PagedResponse<MemberResponse> response = memberService.search(keyword, page, size, sortBy, sortDir);
        return ResponseEntity.ok(ApiResponse.success("Members retrieved successfully", response));
    }

    @Operation(summary = "Get a member's borrowing history")
    @GetMapping("/{id}/history")
    public ResponseEntity<ApiResponse<PagedResponse<BookIssueResponse>>> history(
            @PathVariable Long id,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        PagedResponse<BookIssueResponse> response = memberService.borrowingHistory(id, page, size);
        return ResponseEntity.ok(ApiResponse.success("Borrowing history retrieved successfully", response));
    }

    @Operation(summary = "Delete a member")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        memberService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Member deleted successfully", null));
    }
}
