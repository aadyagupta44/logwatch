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
  private originalHttpEmit: ((...args: any[]) => boolean) | null = null;

  constructor(config: LogWatchConfig) {
    super();
    this.apiKey = config.apiKey;
    this.service = config.service ?? 'service';
    this.baseUrl = config.baseUrl ?? 'http://localhost:8080';
    this.flushInterval = config.flushInterval ?? 5000;
    this.batchSize = config.batchSize ?? 100;
  }

  /** Create a global singleton, attach it, and return it. */
  static init(config: LogWatchConfig): LogWatch {
    LogWatch.instance = new LogWatch(config);
    return LogWatch.instance;
  }

  /**
   * Start capturing HTTP traffic and flushing logs.
   *
   * Patches Node.js core http.Server so every request is captured
   * automatically — works with Express, Fastify, Koa, NestJS, vanilla http,
   * or any other framework.
   */
  attach(): this {
    if (this.timer) return this;
    this._patchHttp();
    this.timer = setInterval(() => { void this.flush(); }, this.flushInterval);
    this.emit('attached');
    return this;
  }

  /** Stop capturing, restore Node.js http, and drain the buffer. */
  detach(): this {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.originalHttpEmit) {
      http.Server.prototype.emit = this.originalHttpEmit as any;
      this.originalHttpEmit = null;
    }
    void this.flush();
    this.emit('detached');
    return this;
  }

  /** Buffer a raw log line manually (for background jobs, queue consumers, etc.). */
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

  /** Flush all buffered lines to the LogWatch ingest API. */
  async flush(): Promise<FlushResult | null> {
    if (this.buffer.length === 0) return null;
    const lines = this.buffer.splice(0);
    try {
      const result = await this._post(lines);
      this.emit('flushed', result);
      return result;
    } catch (err) {
      if (this.listenerCount('error') > 0) {
        this.emit('error', err);
      }
      return null;
    }
  }

  private _patchHttp(): void {
    const self = this;
    const original = http.Server.prototype.emit;
    this.originalHttpEmit = original;

    (http.Server.prototype as any).emit = function (event: string, ...args: any[]) {
      if (event === 'request') {
        const req: http.IncomingMessage = args[0];
        const res: http.ServerResponse = args[1];
        const start = Date.now();
        res.on('finish', () => {
          const latency = Date.now() - start;
          const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
          const status = res.statusCode;
          const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';
          const method = req.method ?? 'GET';
          const path = req.url ?? '/';
          self.log(`${ts} ${level} ${self.service} HTTP ${method} ${path} ${status} ${latency}ms`);
        });
      }
      return (original as Function).apply(this, [event, ...args]);
    };
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
