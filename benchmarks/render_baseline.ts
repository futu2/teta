export type RenderBenchmarkThreshold = {
  maxMsPerRender: number;
  maxSqlChars: number;
};

export const RENDER_BENCHMARK_THRESHOLDS: Record<string, RenderBenchmarkThreshold> = {
  "postgresql/optimized": {
    maxMsPerRender: 0.2,
    maxSqlChars: 500,
  },
  "postgresql/readable": {
    // Readable plans allocate and format several intermediate CTEs. Keep
    // headroom for shared CI runners while the relative slowdown guard below
    // still catches disproportionate regressions.
    maxMsPerRender: 0.45,
    maxSqlChars: 1800,
  },
  "duckdb/optimized": {
    // The median varies by a few microseconds across equivalent runners.
    maxMsPerRender: 0.15,
    maxSqlChars: 500,
  },
  "sqlite/optimized": {
    maxMsPerRender: 0.2,
    maxSqlChars: 550,
  },
};

export const RENDER_BENCHMARK_RELATIONS = {
  readableVsOptimizedMaxSlowdown: 5,
} as const;
