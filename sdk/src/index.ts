import { EventEmitter } from 'events';
import * as https from 'https';
import * as http from 'http';

export interface LogWatchConfig {
  apiKey: string;
  service?: string;
  baseUrl?: string;
  flushInterval?: number;
  batchSize?: number;
}

export interface FlushResult {
  accepted: number;
  dropped: number;
}

export class LogWatch extends EventEmitter {
  private static instance: LogWatch | null = null;

  private readonly apiKey: string;
  private readonly service: string;
  private readonly baseUrl: string;
  private readonly flushInterval: number;
  private readonly batchSize: number;
  private buffer: string[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config: LogWatchConfig) {
    super();
    this.apiKey = config.apiKey;
    this.service = config.service ?? 'service';
    this.baseUrl = config.baseUrl ?? 'http://localhost:8080';
    this.flushInterval = config.flushInterval ?? 5000;
    this.batchSize = config.batchSize ?? 100;
  }

  /**
   * Create a global singleton instance and start flushing.
   * Call once at app startup — use anywhere via the returned instance.
   */
  static init(config: LogWatchConfig): LogWatch {
    LogWatch.instance = new LogWatch(config).attach();
    return LogWatch.instance;
  }

  /** Start periodic flushing of buffered log lines. */
  attach(): this {
    if (this.timer) return this;
    this.timer = setInterval(() => { void this.flush(); }, this.flushInterval);
    this.emit('attached');
    return this;
  }

  /** Stop the flush timer and drain remaining buffer. */
  detach(): this {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    void this.flush();
    this.emit('detached');
    return this;
  }

  /** Buffer a single raw log line for ingestion. */
  log(line: string): this {
    const trimmed = line.trimEnd();
    if (trimmed) {
      this.buffer.push(trimmed);
      if (this.buffer.length >= this.batchSize) {
        void this.flush();
      }
    }
    return this;
  }

  /**
   * Express/Connect middleware.
   * Drop it in with app.use(lw.expressMiddleware()) and every HTTP request
   * is automatically captured and shipped to LogWatch in the correct format.
   */
  expressMiddleware() {
    const self = this;
    return function logwatchMiddleware(req: any, res: any, next: any) {
      const start = Date.now();
      res.on('finish', () => {
        const latency = Date.now() - start;
        const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
        const status: number = res.statusCode;
        const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
        const method: string = req.method ?? 'GET';
        const path: string = req.path ?? req.url ?? '/';
        const line = `${ts} ${level} ${self.service} HTTP ${method} ${path} ${status} ${latency}ms`;
        self.log(line);
      });
      next();
    };
  }

  /** Flush all buffered lines to the LogWatch ingest API. */
  async flush(): Promise<FlushResult | null> {
    if (this.buffer.length === 0) return null;
    const lines = this.buffer.splice(0);
    try {
      const result = await this._post(lines);
      this.emit('flushed', result);
      return result;
    } catch (err) {
      this.emit('error', err);
      return null;
    }
  }

  private _post(lines: string[]): Promise<FlushResult> {
    return new Promise((resolve, reject) => {
      const body = JSON.stringify({ logs: lines });
      const url = new URL('/api/ingest', this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port ? parseInt(url.port, 10) : (isHttps ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-API-Key': this.apiKey,
        } as Record<string, string | number>,
      };

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer | string) => {
          data += typeof chunk === 'string' ? chunk : chunk.toString();
        });
        res.on('end', () => {
          if (res.statusCode !== undefined && res.statusCode >= 400) {
            reject(new Error(`LogWatch ingest failed: HTTP ${res.statusCode}`));
          } else {
            try {
              resolve(JSON.parse(data) as FlushResult);
            } catch {
              resolve({ accepted: lines.length, dropped: 0 });
            }
          }
        });
      });

      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

export default LogWatch;
