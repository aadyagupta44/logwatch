package com.logwatch.controller;

import com.logwatch.dto.LogIngestRequest;
import com.logwatch.metrics.LogwatchMetrics;
import com.logwatch.security.ApiKeyAuthenticationToken;
import com.logwatch.service.IngestService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/ingest")
@RequiredArgsConstructor
@Tag(name = "Ingestion", description = "Endpoints for log ingestion")
public class IngestController {

    private final IngestService ingestService;
    private final LogwatchMetrics logwatchMetrics;

    @PostMapping
    @Operation(
            summary = "Ingest log lines",
            description = "Accepts a list of log lines (max 1000) and publishes them to Kafka. Protected by API Key.",
            security = @SecurityRequirement(name = "apiKey")
    )
    public ResponseEntity<Void> ingest(@RequestBody LogIngestRequest request) {
        ApiKeyAuthenticationToken auth = (ApiKeyAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        UUID orgId = auth.getOrgId();

        ingestService.ingestLogs(request, orgId);
        logwatchMetrics.recordIngestRequest();

        return ResponseEntity.accepted().build();
    }
}
