package com.logwatch.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

@Component
public class MetricsInterceptor implements HandlerInterceptor {

    private final MeterRegistry registry;

    public MetricsInterceptor(MeterRegistry registry) {
        this.registry = registry;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        // Use the matched pattern (e.g. /anomalies/{id}) to keep label cardinality bounded
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        String path = pattern != null ? pattern.toString() : request.getRequestURI();

        Counter.builder("logwatch_api_requests_by_endpoint")
                .description("Total API requests labeled by endpoint path")
                .tag("path", path)
                .tag("method", request.getMethod())
                .register(registry)
                .increment();
    }
}
