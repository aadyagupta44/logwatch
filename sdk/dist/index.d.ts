import { EventEmitter } from 'events';
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
export declare class LogWatch extends EventEmitter {
    private static instance;
    private readonly apiKey;
    private readonly service;
    private readonly baseUrl;
    private readonly flushInterval;
    private readonly batchSize;
    private buffer;
    private timer;
    private originalHttpEmit;
    constructor(config: LogWatchConfig);
    /** Create a global singleton, attach it, and return it. */
    static init(config: LogWatchConfig): LogWatch;
    /**
     * Start capturing HTTP traffic and flushing logs.
     *
     * Patches Node.js core http.Server so every request is captured
     * automatically — works with Express, Fastify, Koa, NestJS, vanilla http,
     * or any other framework.
     */
    attach(): this;
    /** Stop capturing, restore Node.js http, and drain the buffer. */
    detach(): this;
    /** Buffer a raw log line manually (for background jobs, queue consumers, etc.). */
    log(line: string): this;
    /** Flush all buffered lines to the LogWatch ingest API. */
    flush(): Promise<FlushResult | null>;
    private _patchHttp;
    private _post;
}
export default LogWatch;
//# sourceMappingURL=index.d.ts.map