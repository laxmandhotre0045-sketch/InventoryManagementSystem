package com.company.inventory.repository;

import com.company.inventory.entity.Project;
import com.company.inventory.entity.ProjectStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    Page<Project> findByProjectNameContainingIgnoreCase(String projectName, Pageable pageable);

    long countByStatus(ProjectStatus status);

    /**
     * How many projects a person is staffed on, counting the manager slot and the team
     * roster together.
     *
     * <p>COUNT(DISTINCT) matters: someone who both manages a project and appears in its
     * team list would otherwise be counted twice by the join and look busier than they
     * are. Settings uses this to warn before deactivating a staffed member, and the
     * delete guard uses it to explain why a member cannot be removed.</p>
     */
    @Query("SELECT COUNT(DISTINCT p) FROM Project p "
            + "LEFT JOIN p.assignedMembers m "
            + "WHERE p.projectManagerMember.id = :memberId OR m.id = :memberId")
    long countProjectsForMember(@Param("memberId") Long memberId);
}
