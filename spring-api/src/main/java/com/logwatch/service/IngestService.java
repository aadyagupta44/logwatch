package com.logwatch.service;

import com.logwatch.dto.LogIngestRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IngestService {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private static final String TOPIC = "raw-logs";

    public void ingestLogs(LogIngestRequest request, UUID orgId) {
        if (request.getLogs() == null || request.getLogs().isEmpty()) {
            return;
        }

        int limit = Math.min(request.getLogs().size(), 1000);

        for (int i = 0; i < limit; i++) {
            String logLine = request.getLogs().get(i);
            if (logLine != null && !logLine.isBlank()) {
                kafkaTemplate.send(TOPIC, orgId.toString(), logLine);
            }
        }
    }
}
