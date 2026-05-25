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
            start.elapsed() >= Duration::from_secs(20)
        } else {
            false
        }
    }

    pub fn extract_features(&self) -> [f32; 7] {
        let total_count = self.logs.len() as f32;
        if total_count == 0.0 {
            return [0.0; 7];
        }

        let mut error_count = 0.0f32;
        let mut warn_count = 0.0f32;
        let mut info_count = 0.0f32;
        let mut unique_paths = HashSet::new();

        for log in &self.logs {
            match log.level.as_str() {
                "ERROR" => error_count += 1.0,
                "WARN"  => warn_count  += 1.0,
                "INFO"  => info_count  += 1.0,
                _       => {}
            }
            unique_paths.insert(log.path.clone());
        }

        let error_ratio = error_count / total_count;
        let warn_ratio  = warn_count  / total_count;
        let unique_components = unique_paths.len() as f32;

        // Order matches training: total_count, error_count, warn_count, info_count,
        //                         error_ratio, warn_ratio, unique_components
        [
            total_count,
            error_count,
            warn_count,
            info_count,
            error_ratio,
            warn_ratio,
            unique_components,
        ]
    }

    pub fn reset(&mut self) {
        self.logs.clear();
        self.start_time = None;
    }
}
