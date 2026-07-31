package com.company.inventory.library.entity;

import java.time.LocalDateTime;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A library member (employee / student) that books can be issued to.
 * Lives in its own {@code members} table, independent of Inventory tables.
 */
@Entity
@Table(name = "members", indexes = {
        @Index(name = "idx_members_employee_id", columnList = "employee_id", unique = true),
        @Index(name = "idx_members_name", columnList = "name")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "employee_id", nullable = false, unique = true, length = 40)
    private String employeeId;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 120)
    private String department;

    @Column(length = 150)
    private String email;

    @Column(length = 30)
    private String phone;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
