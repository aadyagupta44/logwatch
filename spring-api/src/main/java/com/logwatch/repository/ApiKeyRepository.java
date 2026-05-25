package com.logwatch.repository;

import com.logwatch.model.ApiKey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ApiKeyRepository extends JpaRepository<ApiKey, UUID> {
    java.util.List<ApiKey> findByOrganisationId(UUID orgId);
    Optional<ApiKey> findByKeyHashAndIsActive(String keyHash, Boolean isActive);
}
