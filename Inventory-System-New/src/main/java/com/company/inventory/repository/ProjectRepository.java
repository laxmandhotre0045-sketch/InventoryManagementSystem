package com.company.inventory.repository;

import com.company.inventory.entity.Project;
import com.company.inventory.entity.ProjectStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    Page<Project> findByProjectNameContainingIgnoreCase(String projectName, Pageable pageable);

    long countByStatus(ProjectStatus status);
}
