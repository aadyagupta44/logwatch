package com.logwatch.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "Request body for log ingestion")
public class LogIngestRequest {
    @Schema(description = "List of log lines to ingest", example = "[\"2024-05-11 10:00:00 INFO ServiceA started\", \"2024-05-11 10:00:01 ERROR ServiceA failed\"]")
    private List<String> logs;
}
