package com.company.inventory.repository;

import com.company.inventory.entity.Purchase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PurchaseRepository extends JpaRepository<Purchase, Long> {

    Page<Purchase> findBySupplierNameContainingIgnoreCaseOrInvoiceNumberContainingIgnoreCase(String supplierName, String invoiceNumber, Pageable pageable);

    @Query("select count(p) from Purchase p where month(p.purchaseDate) = month(current_date) and year(p.purchaseDate) = year(current_date)")
    long countPurchasesThisMonth();
}
