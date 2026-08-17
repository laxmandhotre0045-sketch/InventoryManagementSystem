package com.company.inventory.controller;

import java.util.List;

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

import com.company.inventory.dto.request.TeamMemberRequest;
import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.TeamMemberResponse;
import com.company.inventory.service.TeamMemberService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

/**
 * The project staffing roster, managed from Settings.
 *
 * <p>Reading is open to any signed-in user because the projects screen needs the list to
 * populate its manager and team dropdowns. Creating, editing and deleting fall under the
 * blanket admin rule in SecurityConfig — the same split component categories already use,
 * and the reason the management UI lives on the admin-only Settings page.</p>
 */
@RestController
@RequestMapping("/team-members")
@Validated
@Tag(name = "Team Member Management", description = "People who can be assigned to projects")
public class TeamMemberController {

    private final TeamMemberService teamMemberService;

    public TeamMemberController(TeamMemberService teamMemberService) {
        this.teamMemberService = teamMemberService;
    }

    @Operation(summary = "List team members",
            description = "Pass activeOnly=true for the staffing dropdowns; omit it in Settings, "
                    + "which has to show deactivated members in order to reactivate them.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<TeamMemberResponse>>> getAllMembers(
            @Parameter(description = "Return only members still offered for staffing")
            @RequestParam(defaultValue = "false") boolean activeOnly) {
        List<TeamMemberResponse> response = activeOnly
                ? teamMemberService.getActiveMembers()
                : teamMemberService.getAllMembers();
        return ResponseEntity.ok(ApiResponse.success("Team members retrieved successfully", response));
    }

    @Operation(summary = "Get a team member by id")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TeamMemberResponse>> getMemberById(
            @Parameter(description = "Team member identifier", required = true) @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Team member retrieved successfully",
                teamMemberService.getMemberById(id)));
    }

    @Operation(summary = "Add a team member")
    @PostMapping
    public ResponseEntity<ApiResponse<TeamMemberResponse>> createMember(
            @Valid @RequestBody TeamMemberRequest request) {
        TeamMemberResponse response = teamMemberService.createMember(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Team member added successfully", response));
    }

    @Operation(summary = "Update a team member, or deactivate them")
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TeamMemberResponse>> updateMember(
            @Parameter(description = "Team member identifier", required = true) @PathVariable Long id,
            @Valid @RequestBody TeamMemberRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Team member updated successfully",
                teamMemberService.updateMember(id, request)));
    }

    @Operation(summary = "Delete a team member who is not assigned to any project")
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteMember(
            @Parameter(description = "Team member identifier", required = true) @PathVariable Long id) {
        teamMemberService.deleteMember(id);
        return ResponseEntity.ok(ApiResponse.success("Team member deleted successfully", null));
    }
}
