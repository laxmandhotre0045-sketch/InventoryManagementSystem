package com.company.inventory.dto.response;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Data
@Setter
@Getter

public class PagedResponse<T> {

    @Schema(description = "Page content")
    private List<T> content;

    @Schema(description = "Current page index", example = "0")
    private int page;

    @Schema(description = "Size of each page", example = "10")
    private int size;

    @Schema(description = "Total number of elements", example = "55")
    private long totalElements;

    @Schema(description = "Total number of pages", example = "6")
    private int totalPages;

    @Schema(description = "Whether this is the last page", example = "false")
    private boolean last;
}
