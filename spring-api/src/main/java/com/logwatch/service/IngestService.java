package com.logwatch.service;

import com.logwatch.dto.LogIngestRequest;
import com.logwatch.dto.LogMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IngestService {

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private static final String TOPIC = "raw-logs";

    public void ingestLogs(LogIngestRequest request, UUID orgId) {
        if (request.getLogs() == null || request.getLogs().isEmpty()) {
            return;
        }

        // Rate limit: max 1000 log lines per request
        int limit = Math.min(request.getLogs().size(), 1000);
        
        for (int i = 0; i < limit; i++) {
            String log = request.getLogs().get(i);
            LogMessage message = LogMessage.builder()
                    .log(log)
                    .orgId(orgId)
                    .timestamp(System.currentTimeMillis())
                    .build();
            
            kafkaTemplate.send(TOPIC, orgId.toString(), message);
        }
    }
}
