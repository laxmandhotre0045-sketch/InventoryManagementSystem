package com.company.inventory.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.company.inventory.entity.AppSetting;

public interface AppSettingRepository extends JpaRepository<AppSetting, Long> {

    Optional<AppSetting> findBySettingKey(String settingKey);

    List<AppSetting> findByCategory(String category);

    boolean existsBySettingKey(String settingKey);

    List<AppSetting> findAllByOrderByCategoryAscSettingKeyAsc();
}
