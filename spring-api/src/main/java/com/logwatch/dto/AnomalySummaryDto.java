package com.logwatch.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "Summary of anomalies for an organisation")
public class AnomalySummaryDto {
    private long totalCount;
    private double avgScore;
    private Map<String, Long> countBySeverity;
    private Map<String, Long> topServices;
    private Map<String, Long> countByHour;
}
