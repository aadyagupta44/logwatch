use std::collections::HashSet;
use std::time::{Duration, Instant};
use crate::parser::LogLine;

pub struct SlidingWindow {
    pub service: String,
    pub logs: Vec<LogLine>,
    pub start_time: Option<Instant>,
}

impl SlidingWindow {
    pub fn new(service: String) -> Self {
        Self {
            service,
            logs: Vec::new(),
            start_time: None,
        }
    }

    pub fn add(&mut self, log: LogLine) {
        if self.start_time.is_none() {
            self.start_time = Some(Instant::now());
        }
        self.logs.push(log);
    }

    pub fn should_flush(&self) -> bool {
        if let Some(start) = self.start_time {
            start.elapsed() >= Duration::from_secs(60)
        } else {
            false
        }
    }

    pub fn extract_features(&self) -> [f32; 7] {
        let total_count = self.logs.len() as f32;
        if total_count == 0.0 {
            return [0.0; 7];
        }

        let mut error_count = 0.0;
        let mut warn_count = 0.0;
        let mut sum_latency = 0.0;
        let mut latencies = Vec::with_capacity(self.logs.len());
        let mut unique_errors = HashSet::new();

        for log in &self.logs {
            if log.level == "ERROR" {
                error_count += 1.0;
                // Using status_code as proxy for unique errors
                unique_errors.insert(log.status_code);
            } else if log.level == "WARN" {
                warn_count += 1.0;
            }
            
            let lat = log.latency_ms as f32;
            sum_latency += lat;
            latencies.push(lat);
        }

        let avg_latency = sum_latency / total_count;
        let error_ratio = error_count / total_count;
        let unique_error_count = unique_errors.len() as f32;

        // Calculate p99 latency
        latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let p99_idx = ((total_count * 0.99).ceil() as usize)
            .saturating_sub(1)
            .min(latencies.len().saturating_sub(1));
        let p99_latency = if latencies.is_empty() { 0.0 } else { latencies[p99_idx] };

        [
            total_count,
            error_count,
            warn_count,
            avg_latency,
            p99_latency,
            unique_error_count,
            error_ratio,
        ]
    }

    pub fn reset(&mut self) {
        self.logs.clear();
        self.start_time = None;
    }
}
