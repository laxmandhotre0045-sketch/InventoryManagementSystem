package com.company.inventory.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.company.inventory.entity.ProjectStock;

public interface ProjectStockRepository extends JpaRepository<ProjectStock, Long> {

    @Query("select ps from ProjectStock ps join fetch ps.component c left join fetch c.category "
            + "where ps.project.id = :projectId order by ps.createdAt asc, ps.id asc")
    List<ProjectStock> findForProject(@Param("projectId") Long projectId);

    boolean existsByProjectId(Long projectId);

    /** [componentId, projectId, projectName, sum(quantity)] for the given components. */
    @Query("select ps.component.id, ps.project.id, ps.project.projectName, sum(ps.quantity) from ProjectStock ps "
            + "where ps.component.id in :componentIds group by ps.component.id, ps.project.id, ps.project.projectName")
    List<Object[]> allocationsForComponents(@Param("componentIds") Collection<Long> componentIds);

    /** [projectId, sum(quantity * unitPrice), count(distinct component)] for the given projects. */
    @Query("select ps.project.id, sum(ps.quantity * coalesce(ps.unitPrice, 0)), count(distinct ps.component.id) "
            + "from ProjectStock ps where ps.project.id in :projectIds group by ps.project.id")
    List<Object[]> costsForProjects(@Param("projectIds") Collection<Long> projectIds);
}
