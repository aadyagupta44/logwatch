"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogWatch = void 0;
const events_1 = require("events");
const https = __importStar(require("https"));
const http = __importStar(require("http"));
class LogWatch extends events_1.EventEmitter {
    constructor(config) {
        super();
        this.buffer = [];
        this.timer = null;
        this.originalHttpEmit = null;
        this.apiKey = config.apiKey;
        this.service = config.service ?? 'service';
        this.baseUrl = config.baseUrl ?? 'http://localhost:8080';
        this.flushInterval = config.flushInterval ?? 5000;
        this.batchSize = config.batchSize ?? 100;
    }
    /** Create a global singleton, attach it, and return it. */
    static init(config) {
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
    attach() {
        if (this.timer)
            return this;
        this._patchHttp();
        this.timer = setInterval(() => { void this.flush(); }, this.flushInterval);
        this.emit('attached');
        return this;
    }
    /** Stop capturing, restore Node.js http, and drain the buffer. */
    detach() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.originalHttpEmit) {
            http.Server.prototype.emit = this.originalHttpEmit;
            this.originalHttpEmit = null;
        }
        void this.flush();
        this.emit('detached');
        return this;
    }
    /** Buffer a raw log line manually (for background jobs, queue consumers, etc.). */
    log(line) {
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
    async flush() {
        if (this.buffer.length === 0)
            return null;
        const lines = this.buffer.splice(0);
        try {
            const result = await this._post(lines);
            this.emit('flushed', result);
            return result;
        }
        catch (err) {
            this.emit('error', err);
            return null;
        }
    }
    _patchHttp() {
        const self = this;
        const original = http.Server.prototype.emit;
        this.originalHttpEmit = original;
        http.Server.prototype.emit = function (event, ...args) {
            if (event === 'request') {
                const req = args[0];
                const res = args[1];
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
            return original.apply(this, args);
        };
    }
    _post(lines) {
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
                },
            };
            const req = transport.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += typeof chunk === 'string' ? chunk : chunk.toString();
                });
                res.on('end', () => {
                    if (res.statusCode !== undefined && res.statusCode >= 400) {
                        reject(new Error(`LogWatch ingest failed: HTTP ${res.statusCode}`));
                    }
                    else {
                        try {
                            resolve(JSON.parse(data));
                        }
                        catch {
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
exports.LogWatch = LogWatch;
LogWatch.instance = null;
exports.default = LogWatch;
//# sourceMappingURL=index.js.map