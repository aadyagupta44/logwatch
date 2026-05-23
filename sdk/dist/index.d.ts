import { EventEmitter } from 'events';
export interface LogWatchConfig {
    apiKey: string;
    baseUrl?: string;
    flushInterval?: number;
    batchSize?: number;
}
export interface FlushResult {
    accepted: number;
    dropped: number;
}
export declare class LogWatch extends EventEmitter {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly flushInterval;
    private readonly batchSize;
    private buffer;
    private timer;
    constructor(config: LogWatchConfig);
    /** Start periodic flushing of buffered log lines. */
    attach(): this;
    /** Stop the flush timer and drain remaining buffer. */
    detach(): this;
    /** Buffer a single log line for ingestion. */
    log(line: string): this;
    /** Flush all buffered lines to the LogWatch ingest API. */
    flush(): Promise<FlushResult | null>;
    private _post;
}
export default LogWatch;
//# sourceMappingURL=index.d.ts.map