package com.company.inventory.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class EquipmentResponse {

    @Schema(description = "Equipment record identifier", example = "1")
    private Long id;

    @Schema(description = "Equipment name", example = "Laptop Dell XPS 15")
    private String name;

    @Schema(description = "Serial number of the equipment", example = "SN12345678")
    private String serialNumber;

    @Schema(description = "Equipment category", example = "Laptops")
    private String category;

    @Schema(description = "Manufacturer name", example = "Dell")
    private String manufacturer;

    @Schema(description = "Date of purchase")
    private LocalDate purchaseDate;

    @Schema(description = "Warranty expiry date")
    private LocalDate warrantyExpiry;

    @Schema(description = "Current equipment status", example = "AVAILABLE")
    private String status;

    @Schema(description = "Current equipment location", example = "Main warehouse")
    private String location;

    @Schema(description = "Additional notes", example = "16GB RAM, 512GB SSD")
    private String notes;

    @Schema(description = "Record created timestamp")
    private LocalDateTime createdAt;

    @Schema(description = "Record updated timestamp")
    private LocalDateTime updatedAt;
}
