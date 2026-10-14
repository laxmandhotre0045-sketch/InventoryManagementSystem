package com.company.inventory.controller;

import java.io.IOException;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.company.inventory.dto.response.ApiResponse;
import com.company.inventory.dto.response.BomCheckResponse;
import com.company.inventory.service.BomCheckService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Upload a Bill of Materials (Excel or CSV) and find out which parts are in stock
 * and which must be ordered before a build. Read-only: nothing is stored or changed.
 * Open to ADMIN and USER (see SecurityConfig), since it only reads the catalogue.
 */
@RestController
@RequestMapping("/bom")
@Tag(name = "BOM Check", description = "Check a BOM / Excel parts list against inventory stock")
public class BomCheckController {

    private final BomCheckService bomCheckService;

    public BomCheckController(BomCheckService bomCheckService) {
        this.bomCheckService = bomCheckService;
    }

    @Operation(summary = "Check a BOM file against inventory (read-only)",
            description = "Accepts .xlsx, .xls, .csv, .tsv or .txt. Each line is matched to an inventory "
                    + "component and reported as AVAILABLE, PARTIAL or TO_ORDER. Quantities are multiplied "
                    + "by 'boards'. No data is created or modified.")
    @PostMapping(value = "/check", consumes = "multipart/form-data")
    public ResponseEntity<ApiResponse<BomCheckResponse>> check(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "boards", defaultValue = "1") int boards) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Please choose a BOM file to upload.");
        }
        BomCheckResponse result = bomCheckService.check(file.getBytes(), file.getOriginalFilename(), boards);
        return ResponseEntity.ok(ApiResponse.success("BOM checked", result));
    }
}
