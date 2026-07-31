package com.company.inventory.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.company.inventory.entity.InvoiceExtraction;

public interface InvoiceExtractionRepository extends JpaRepository<InvoiceExtraction, Long> {
}
