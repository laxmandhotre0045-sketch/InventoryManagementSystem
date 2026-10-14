package com.company.inventory.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.company.inventory.entity.ItemSpecification;

public interface ItemSpecificationRepository extends JpaRepository<ItemSpecification, Long> {

    List<ItemSpecification> findByItemTypeAndItemIdOrderBySortOrderAscIdAsc(String itemType, Long itemId);

    @Modifying
    @Query("delete from ItemSpecification s where s.itemType = :itemType and s.itemId = :itemId")
    void deleteAllFor(@Param("itemType") String itemType, @Param("itemId") Long itemId);
}
