package com.logwatch.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "Details of a detected anomaly")
public class AnomalyDto {
    private UUID id;
    private String serviceName;
    private LocalDateTime detectedAt;
    private Double anomalyScore;
    private String featureVector;
    private String severity;
    private Boolean acknowledged;
}
