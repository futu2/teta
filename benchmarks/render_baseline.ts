export type RenderBenchmarkThreshold = {
  maxMsPerRender: number;
  maxSqlChars: number;
};

export const RENDER_BENCHMARK_THRESHOLDS: Record<string, RenderBenchmarkThreshold> = {
  "postgresql/optimized": {
    // Keep enough headroom for shared CI runners; SQL-size and relative
    // readable-vs-optimized checks still catch meaningful regressions.
    maxMsPerRender: 0.3,
    maxSqlChars: 500,
  },
  "postgresql/readable": {
    // Readable plans allocate and format several intermediate CTEs. Keep
    // headroom for shared CI runners while the relative slowdown guard below
    // still catches disproportionate regressions.
    maxMsPerRender: 0.6,
    maxSqlChars: 1800,
  },
  "duckdb/optimized": {
    maxMsPerRender: 0.3,
    maxSqlChars: 500,
  },
  "sqlite/optimized": {
    maxMsPerRender: 0.3,
    maxSqlChars: 550,
  },
};

export const RENDER_BENCHMARK_RELATIONS = {
  readableVsOptimizedMaxSlowdown: 5,
} as const;
