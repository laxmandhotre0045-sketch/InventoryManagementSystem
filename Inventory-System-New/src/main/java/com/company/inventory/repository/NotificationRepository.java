package com.company.inventory.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.company.inventory.entity.Notification;
import com.company.inventory.entity.NotificationType;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    Page<Notification> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Notification> findByReadFalseOrderByCreatedAtDesc(Pageable pageable);

    List<Notification> findTop8ByOrderByCreatedAtDesc();

    long countByReadFalse();

    /** Used to avoid spamming duplicate unread stock alerts for the same item. */
    boolean existsByTypeAndReferenceIdAndReadFalse(NotificationType type, Long referenceId);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.read = false")
    int markAllRead();
}
