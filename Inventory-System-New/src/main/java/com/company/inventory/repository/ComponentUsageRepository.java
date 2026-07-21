package com.company.inventory.repository;

import com.company.inventory.entity.ComponentUsage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ComponentUsageRepository extends JpaRepository<ComponentUsage, Long> {
}
