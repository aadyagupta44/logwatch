package com.logwatch.service;

import com.logwatch.dto.AnomalyDto;
import com.logwatch.dto.AnomalySummaryDto;
import com.logwatch.model.Anomaly;
import com.logwatch.repository.AnomalyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AnomalyService {

    private final AnomalyRepository anomalyRepository;

    public Page<AnomalyDto> getAnomalies(UUID orgId, String service, LocalDateTime from, LocalDateTime to, String severity, Pageable pageable) {
        if (service == null && from == null && to == null && severity == null) {
            return anomalyRepository.findByOrganisationId(orgId, pageable).map(this::convertToDto);
        }
        return anomalyRepository.findFiltered(orgId, service, from, to, severity, pageable)
                .map(this::convertToDto);
    }

    public AnomalyDto getAnomaly(UUID id, UUID orgId) {
        return anomalyRepository.findByIdAndOrganisationId(id, orgId)
                .map(this::convertToDto)
                .orElseThrow(() -> new RuntimeException("Anomaly not found"));
    }

    public List<AnomalyDto> getAnomaliesByService(String serviceName, UUID orgId) {
        return anomalyRepository.findByOrganisationIdAndServiceName(orgId, serviceName).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public AnomalySummaryDto getSummary(UUID orgId) {
        long total = anomalyRepository.countByOrganisationId(orgId);
        
        Map<String, Long> severityCounts = anomalyRepository.countBySeverity(orgId).stream()
                .collect(Collectors.toMap(
                        row -> (String) row[0],
                        row -> (Long) row[1]
                ));

        Map<String, Long> topServices = anomalyRepository.findTopServices(orgId, PageRequest.of(0, 5)).stream()
                .collect(Collectors.toMap(
                        row -> (String) row[0],
                        row -> (Long) row[1]
                ));

        Map<String, Long> countByHour = anomalyRepository.countByHour(orgId, LocalDateTime.now().minusHours(24)).stream()
                .collect(Collectors.toMap(
                        row -> (String) row[0],
                        row -> (Long) row[1]
                ));

        return AnomalySummaryDto.builder()
                .totalCount(total)
                .countBySeverity(severityCounts)
                .topServices(topServices)
                .countByHour(countByHour)
                .build();
    }

    @Transactional
    public void acknowledgeAnomaly(UUID id, UUID orgId) {
        Anomaly anomaly = anomalyRepository.findByIdAndOrganisationId(id, orgId)
                .orElseThrow(() -> new RuntimeException("Anomaly not found"));
        anomaly.setAcknowledged(true);
        anomalyRepository.save(anomaly);
    }

    @Transactional
    public void deleteAnomaly(UUID id, UUID orgId) {
        Anomaly anomaly = anomalyRepository.findByIdAndOrganisationId(id, orgId)
                .orElseThrow(() -> new RuntimeException("Anomaly not found"));
        anomalyRepository.delete(anomaly);
    }

    private AnomalyDto convertToDto(Anomaly anomaly) {
        return AnomalyDto.builder()
                .id(anomaly.getId())
                .serviceName(anomaly.getServiceName())
                .detectedAt(anomaly.getDetectedAt())
                .anomalyScore(anomaly.getAnomalyScore())
                .featureVector(anomaly.getFeatureVector())
                .severity(anomaly.getSeverity())
                .acknowledged(anomaly.getAcknowledged())
                .build();
    }
}
