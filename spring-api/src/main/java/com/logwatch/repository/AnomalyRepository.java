package com.logwatch.repository;

import com.logwatch.model.Anomaly;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;

import com.logwatch.model.Anomaly;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AnomalyRepository extends JpaRepository<Anomaly, UUID> {
    Page<Anomaly> findByOrganisationId(UUID orgId, Pageable pageable);
    
    @Query("SELECT a FROM Anomaly a WHERE a.organisation.id = :orgId " +
           "AND (:service IS NULL OR a.serviceName = :service) " +
           "AND (:from IS NULL OR a.detectedAt >= :from) " +
           "AND (:to IS NULL OR a.detectedAt <= :to) " +
           "AND (:severity IS NULL OR a.severity = :severity)")
    Page<Anomaly> findFiltered(UUID orgId, String service, LocalDateTime from, LocalDateTime to, String severity, Pageable pageable);

    List<Anomaly> findByOrganisationIdAndServiceName(UUID orgId, String serviceName);

    long countByOrganisationId(UUID orgId);

    @Query("SELECT a.severity, COUNT(a) FROM Anomaly a WHERE a.organisation.id = :orgId GROUP BY a.severity")
    List<Object[]> countBySeverity(UUID orgId);

    @Query("SELECT a.serviceName, COUNT(a) FROM Anomaly a WHERE a.organisation.id = :orgId GROUP BY a.serviceName ORDER BY COUNT(a) DESC")
    List<Object[]> findTopServices(UUID orgId, Pageable pageable);

    @Query(value = "SELECT CAST(date_trunc('hour', detected_at) AS varchar) as hr, COUNT(*) FROM anomalies " +
           "WHERE org_id = :orgId AND detected_at >= :since GROUP BY hr ORDER BY hr", nativeQuery = true)
    List<Object[]> countByHour(UUID orgId, LocalDateTime since);

    Optional<Anomaly> findByIdAndOrganisationId(UUID id, UUID orgId);
}
