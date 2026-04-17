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
    maxMsPerRender: 0.35,
    maxSqlChars: 1800,
  },
  "duckdb/optimized": {
    maxMsPerRender: 0.12,
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
