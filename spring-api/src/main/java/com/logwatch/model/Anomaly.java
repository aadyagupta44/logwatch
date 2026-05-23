package com.logwatch.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "anomalies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Anomaly {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "service_name", nullable = false)
    private String serviceName;

    @CreationTimestamp
    @Column(name = "detected_at", updatable = false)
    private LocalDateTime detectedAt;

    @Column(name = "anomaly_score")
    private Double anomalyScore;

    @Column(name = "feature_vector", columnDefinition = "TEXT")
    private String featureVector;

    @Column(nullable = false)
    private String severity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "org_id", nullable = false)
    private Organisation organisation;

    @Column(nullable = false)
    @Builder.Default
    private Boolean acknowledged = false;
}
