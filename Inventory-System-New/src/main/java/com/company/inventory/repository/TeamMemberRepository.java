package com.company.inventory.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.company.inventory.entity.TeamMember;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    /**
     * Case-insensitive name lookup, used to turn a duplicate into a readable message
     * before the unique index turns it into a constraint violation.
     */
    Optional<TeamMember> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);

    List<TeamMember> findAllByOrderByNameAsc();

    /** The dropdown list: retired members stay in the database but are not offered. */
    List<TeamMember> findByActiveTrueOrderByNameAsc();
}
