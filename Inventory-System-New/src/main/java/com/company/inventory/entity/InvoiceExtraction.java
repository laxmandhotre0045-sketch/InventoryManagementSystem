package com.company.inventory.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Audit record of every uploaded invoice and its extraction result.
 *
 * Kept separate from Purchase so an upload is tracked even if the user never
 * confirms it, and so the raw provider output is retained for traceability and
 * for the future AI/ML pipeline. On confirmation the row is linked to the
 * created purchase and marked CONFIRMED.
 */
@Entity
@Table(name = "invoice_extractions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InvoiceExtraction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_path", nullable = false, length = 255)
    private String filePath;

    @Column(name = "original_filename", length = 255)
    private String originalFilename;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Column(length = 50)
    private String provider;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExtractionStatus status;

    /** Full structured extraction as JSON — the provider's raw output. */
    @Column(name = "raw_json", columnDefinition = "LONGTEXT")
    private String rawJson;

    /** Set once a purchase is created from this extraction. */
    @Column(name = "purchase_id")
    private Long purchaseId;

    @Column(name = "created_by", length = 120)
    private String createdBy;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
        if (status == null) {
            status = ExtractionStatus.EXTRACTED;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
