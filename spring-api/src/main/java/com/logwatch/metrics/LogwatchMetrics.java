package com.logwatch.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

@Component
public class LogwatchMetrics {

    private final Counter ingestRequestsTotal;

    public LogwatchMetrics(MeterRegistry registry) {
        this.ingestRequestsTotal = Counter.builder("logwatch_ingest_requests_total")
                .description("Total number of log ingest requests received")
                .register(registry);
    }

    public void recordIngestRequest() {
        ingestRequestsTotal.increment();
    }
}
