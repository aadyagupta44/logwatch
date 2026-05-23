//! nom-based parser for structured microservice log lines.
//!
//! Accepted format:
//!   `2024-01-15T10:23:45Z INFO payment-service HTTP GET /api/charge 200 45ms`
//!
//! Fields
//! ------
//! | position | example                | field         |
//! |----------|------------------------|---------------|
//! | 1        | `2024-01-15T10:23:45Z` | timestamp     |
//! | 2        | `INFO`                 | level         |
//! | 3        | `payment-service`      | service       |
//! | 4        | `HTTP`                 | (protocol, consumed but not stored) |
//! | 5        | `GET`                  | method        |
//! | 6        | `/api/charge`          | path          |
//! | 7        | `200`                  | status_code   |
//! | 8        | `45ms`                 | latency_ms    |

use nom::{
    bytes::complete::{tag, take_till, take_while1},
    character::complete::{digit1, space1},
    combinator::{map, map_res},
    sequence::{terminated, tuple},
    IResult,
};

// ── Data model ────────────────────────────────────────────────────────────────

#[derive(Debug, PartialEq)]
pub struct LogLine {
    pub timestamp:   String,
    pub level:       String,
    pub service:     String,
    pub method:      String,
    pub path:        String,
    pub status_code: u16,
    pub latency_ms:  u64,
}

// ── Low-level combinators ─────────────────────────────────────────────────────

/// Parse a contiguous token (no spaces).
fn token(input: &str) -> IResult<&str, &str> {
    take_till(|c: char| c.is_whitespace())(input)
}

/// Parse a u16 from ASCII digits.
fn parse_u16(input: &str) -> IResult<&str, u16> {
    map_res(digit1, |s: &str| s.parse::<u16>())(input)
}

/// Parse a u64 from ASCII digits.
fn parse_u64(input: &str) -> IResult<&str, u64> {
    map_res(digit1, |s: &str| s.parse::<u64>())(input)
}

/// Parse a latency token such as `45ms` → 45u64.
fn parse_latency(input: &str) -> IResult<&str, u64> {
    let (rest, ms) = parse_u64(input)?;
    let (rest, _)  = tag("ms")(rest)?;
    Ok((rest, ms))
}

// ── Top-level parser ──────────────────────────────────────────────────────────

/// Parse a single log line into a [`LogLine`].
///
/// Returns `Err` if the line does not match the expected format.
pub fn parse_log_line(input: &str) -> IResult<&str, LogLine> {
    let (rest, (timestamp, _, level, _, service, _, _, method, _, path, _, status_code, _, latency_ms)) =
        tuple((
            // 1. Timestamp
            map(token, str::to_owned),
            space1,
            // 2. Level  (INFO / WARN / ERROR / …)
            map(take_while1(|c: char| c.is_ascii_uppercase()), str::to_owned),
            space1,
            // 3. Service name (may contain hyphens)
            map(token, str::to_owned),
            space1,
            // 4. Protocol literal "HTTP" – consumed, not stored
            terminated(tag("HTTP"), space1),
            // (space already consumed by terminated above)
            // 5. HTTP method
            map(token, str::to_owned),
            space1,
            // 6. Path
            map(token, str::to_owned),
            space1,
            // 7. Status code
            parse_u16,
            space1,
            // 8. Latency  e.g. `45ms`
            parse_latency,
        ))(input)?;

    Ok((
        rest,
        LogLine {
            timestamp,
            level,
            service,
            method,
            path,
            status_code,
            latency_ms,
        },
    ))
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: parse a line and panic with a clear message on failure.
    fn must_parse(line: &str) -> LogLine {
        match parse_log_line(line) {
            Ok((remaining, log)) => {
                assert!(
                    remaining.trim().is_empty(),
                    "Unexpected trailing input: {remaining:?}"
                );
                log
            }
            Err(e) => panic!("Failed to parse log line.\nInput  : {line:?}\nError  : {e:?}"),
        }
    }

    // ── Test 1: Normal INFO request ───────────────────────────────────────────
    #[test]
    fn test_parse_info_line() {
        let line = "2024-01-15T10:23:45Z INFO payment-service HTTP GET /api/charge 200 45ms";
        let log  = must_parse(line);

        assert_eq!(log.timestamp,   "2024-01-15T10:23:45Z");
        assert_eq!(log.level,       "INFO");
        assert_eq!(log.service,     "payment-service");
        assert_eq!(log.method,      "GET");
        assert_eq!(log.path,        "/api/charge");
        assert_eq!(log.status_code, 200);
        assert_eq!(log.latency_ms,  45);
    }

    // ── Test 2: WARN POST request ─────────────────────────────────────────────
    #[test]
    fn test_parse_warn_post_line() {
        let line = "2024-01-15T11:00:00Z WARN auth-service HTTP POST /api/v1/login 429 312ms";
        let log  = must_parse(line);

        assert_eq!(log.timestamp,   "2024-01-15T11:00:00Z");
        assert_eq!(log.level,       "WARN");
        assert_eq!(log.service,     "auth-service");
        assert_eq!(log.method,      "POST");
        assert_eq!(log.path,        "/api/v1/login");
        assert_eq!(log.status_code, 429);
        assert_eq!(log.latency_ms,  312);
    }

    // ── Test 3: ERROR with high latency (anomaly scenario) ───────────────────
    #[test]
    fn test_parse_error_high_latency_line() {
        let line = "2024-01-15T14:55:02Z ERROR db-service HTTP GET /api/v1/query 500 7843ms";
        let log  = must_parse(line);

        assert_eq!(log.timestamp,   "2024-01-15T14:55:02Z");
        assert_eq!(log.level,       "ERROR");
        assert_eq!(log.service,     "db-service");
        assert_eq!(log.method,      "GET");
        assert_eq!(log.path,        "/api/v1/query");
        assert_eq!(log.status_code, 500);
        assert_eq!(log.latency_ms,  7843);

        // Sanity-check anomaly thresholds used by the ML pipeline
        assert!(log.status_code >= 500, "should be a server error");
        assert!(log.latency_ms  > 2_000, "should be a high-latency event");
    }

    // ── Test 4: Malformed line returns an Err ─────────────────────────────────
    #[test]
    fn test_malformed_line_returns_error() {
        let bad = "not a valid log line at all";
        assert!(
            parse_log_line(bad).is_err(),
            "Expected parse to fail for malformed input"
        );
    }
}
