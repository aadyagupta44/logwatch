package com.logwatch.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.logwatch.dto.LogIngestRequest;
import com.logwatch.dto.LogMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class IngestService {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private static final String TOPIC = "raw-logs";

    public void ingestLogs(LogIngestRequest request, UUID orgId) {
        if (request.getLogs() == null || request.getLogs().isEmpty()) {
            return;
        }

        int limit = Math.min(request.getLogs().size(), 1000);

        for (int i = 0; i < limit; i++) {
            String logLine = request.getLogs().get(i);
            LogMessage message = LogMessage.builder()
                    .log(logLine)
                    .orgId(orgId)
                    .timestamp(System.currentTimeMillis())
                    .build();
            try {
                String json = objectMapper.writeValueAsString(message);
                kafkaTemplate.send(TOPIC, orgId.toString(), json);
            } catch (JsonProcessingException e) {
                log.error("Failed to serialize log message", e);
            }
        }
    }
}
