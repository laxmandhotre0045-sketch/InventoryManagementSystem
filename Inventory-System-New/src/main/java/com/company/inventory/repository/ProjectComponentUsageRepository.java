package com.company.inventory.repository;

import com.company.inventory.entity.ProjectComponentUsage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectComponentUsageRepository extends JpaRepository<ProjectComponentUsage, Long> {

    Page<ProjectComponentUsage> findByProjectId(Long projectId, Pageable pageable);

    boolean existsByComponentId(Long componentId);

    Page<ProjectComponentUsage> findByComponentId(Long componentId, Pageable pageable);

    @Query("select coalesce(sum(u.quantityUsed), 0) from ProjectComponentUsage u where u.project.id = :projectId")
    Integer sumQuantityUsedByProjectId(@Param("projectId") Long projectId);
}
