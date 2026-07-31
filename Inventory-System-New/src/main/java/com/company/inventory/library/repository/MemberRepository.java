package com.company.inventory.library.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.company.inventory.library.entity.Member;

@Repository
public interface MemberRepository extends JpaRepository<Member, Long> {

    boolean existsByEmployeeIdIgnoreCase(String employeeId);

    boolean existsByEmployeeIdIgnoreCaseAndIdNot(String employeeId, Long id);

    Optional<Member> findByEmployeeIdIgnoreCase(String employeeId);

    @Query("SELECT m FROM Member m WHERE "
            + "(:keyword IS NULL OR :keyword = '' "
            + " OR LOWER(m.name) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + " OR LOWER(m.employeeId) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + " OR LOWER(m.email) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + " OR LOWER(m.department) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<Member> search(@Param("keyword") String keyword, Pageable pageable);
}
