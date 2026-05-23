package com.logwatch.controller;

import com.logwatch.dto.AnomalyDto;
import com.logwatch.dto.AnomalySummaryDto;
import com.logwatch.security.JwtAuthenticationToken;
import com.logwatch.service.AnomalyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/anomalies")
@RequiredArgsConstructor
@Tag(name = "Anomalies", description = "Endpoints for anomaly management")
@SecurityRequirement(name = "bearerAuth")
public class AnomalyController {

    private final AnomalyService anomalyService;

    @GetMapping
    @Operation(summary = "Get paginated anomalies with filters")
    public ResponseEntity<Page<AnomalyDto>> getAnomalies(
            @RequestParam(required = false) String service,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(required = false) String severity,
            Pageable pageable
    ) {
        return ResponseEntity.ok(anomalyService.getAnomalies(getOrgId(), service, from, to, severity, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a single anomaly by ID")
    public ResponseEntity<AnomalyDto> getAnomaly(@PathVariable UUID id) {
        return ResponseEntity.ok(anomalyService.getAnomaly(id, getOrgId()));
    }

    @GetMapping("/service/{name}")
    @Operation(summary = "Get all anomalies for a specific service")
    public ResponseEntity<List<AnomalyDto>> getByService(@PathVariable String name) {
        return ResponseEntity.ok(anomalyService.getAnomaliesByService(name, getOrgId()));
    }

    @GetMapping("/summary")
    @Operation(summary = "Get anomaly summary statistics")
    public ResponseEntity<AnomalySummaryDto> getSummary() {
        return ResponseEntity.ok(anomalyService.getSummary(getOrgId()));
    }

    @PatchMapping("/{id}/acknowledge")
    @Operation(summary = "Acknowledge an anomaly")
    public ResponseEntity<Void> acknowledge(@PathVariable UUID id) {
        anomalyService.acknowledgeAnomaly(id, getOrgId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an anomaly")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        anomalyService.deleteAnomaly(id, getOrgId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/health")
    @Operation(summary = "Health check")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP"));
    }

    private UUID getOrgId() {
        JwtAuthenticationToken auth = (JwtAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        return auth.getOrgId();
    }
}
