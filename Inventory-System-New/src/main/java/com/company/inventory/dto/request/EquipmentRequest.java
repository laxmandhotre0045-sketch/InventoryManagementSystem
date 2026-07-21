package com.company.inventory.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class EquipmentRequest {

    @Schema(description = "Equipment name", example = "Laptop Dell XPS 15")
    @NotBlank(message = "Name is required")
    @Size(max = 150, message = "Name must be at most 150 characters")
    private String name;

    @Schema(description = "Serial number of the equipment", example = "SN12345678")
    @Size(max = 100, message = "Serial number must be at most 100 characters")
    private String serialNumber;

    @Schema(description = "Equipment category", example = "Laptops")
    @Size(max = 100, message = "Category must be at most 100 characters")
    private String category;

    @Schema(description = "Manufacturer name", example = "Dell")
    @Size(max = 120, message = "Manufacturer must be at most 120 characters")
    private String manufacturer;

    @Schema(description = "Date of purchase")
    private LocalDate purchaseDate;

    @Schema(description = "Warranty expiry date")
    private LocalDate warrantyExpiry;

    @Schema(description = "Current equipment status", example = "AVAILABLE")
    @Size(max = 60, message = "Status must be at most 60 characters")
    private String status;

    @Schema(description = "Current equipment location", example = "Main warehouse")
    @Size(max = 120, message = "Location must be at most 120 characters")
    private String location;

    @Schema(description = "Additional notes", example = "16GB RAM, 512GB SSD")
    @Size(max = 500, message = "Notes must be at most 500 characters")
    private String notes;
}
