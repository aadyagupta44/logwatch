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
    constructor(config: LogWatchConfig);
    /**
     * Create a global singleton instance and start flushing.
     * Call once at app startup — use anywhere via the returned instance.
     */
    static init(config: LogWatchConfig): LogWatch;
    /** Start periodic flushing of buffered log lines. */
    attach(): this;
    /** Stop the flush timer and drain remaining buffer. */
    detach(): this;
    /** Buffer a single raw log line for ingestion. */
    log(line: string): this;
    /**
     * Express/Connect middleware.
     * Drop it in with app.use(lw.expressMiddleware()) and every HTTP request
     * is automatically captured and shipped to LogWatch in the correct format.
     */
    expressMiddleware(): (req: any, res: any, next: any) => void;
    /** Flush all buffered lines to the LogWatch ingest API. */
    flush(): Promise<FlushResult | null>;
    private _post;
}
export default LogWatch;
//# sourceMappingURL=index.d.ts.map