package com.company.inventory.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "purchases")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Purchase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @Column(name = "supplier_name", length = 150)
    private String supplierName;

    @Column(name = "invoice_number", nullable = false, unique = true, length = 120)
    private String invoiceNumber;

    private LocalDate purchaseDate;

    @Column(name = "total_amount", nullable = false)
    private BigDecimal totalAmount;

    @Column(name = "invoice_file_path", length = 255)
    private String invoiceFilePath;

    @Column(name = "invoice_file_original_name", length = 255)
    private String invoiceFileOriginalName;

    @Column(name = "invoice_file_stored_name", length = 255)
    private String invoiceFileStoredName;

    /** When the invoice document was attached — distinct from when the purchase was created. */
    @Column(name = "invoice_uploaded_at")
    private LocalDateTime invoiceUploadedAt;

    @Column(name = "invoice_uploaded_by", length = 120)
    private String invoiceUploadedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "invoice_processing_status", length = 50)
    private InvoiceProcessingStatus invoiceProcessingStatus;

    @Column(length = 1000)
    private String remarks;

    @Column(name = "created_by", length = 120)
    private String createdBy;

    @OneToMany(mappedBy = "purchase", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseItem> items = new ArrayList<>();

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
