import {
  RENDER_BENCHMARK_RELATIONS,
  RENDER_BENCHMARK_THRESHOLDS,
} from "./render_baseline.ts";
import {
  formatRenderBenchmarkMeasurement,
  runRenderBenchmark,
} from "./render_shared.ts";

const runs = parsePositiveInteger(process.env.TETA_BENCH_CHECK_RUNS, 2000);
const warmupRuns = parsePositiveInteger(process.env.TETA_BENCH_CHECK_WARMUP_RUNS, 250);
const samples = parsePositiveInteger(process.env.TETA_BENCH_CHECK_SAMPLES, 5);

const measurements = runRenderBenchmark({ runs, warmupRuns, samples });
for (const measurement of measurements) {
  console.log(formatRenderBenchmarkMeasurement(measurement));
}

const byLabel = new Map(measurements.map((measurement) => [measurement.label, measurement]));
const failures: string[] = [];

for (const measurement of measurements) {
  const threshold = RENDER_BENCHMARK_THRESHOLDS[measurement.label];
  if (!threshold) {
    failures.push(`Missing benchmark threshold for ${measurement.label}`);
    continue;
  }
  if (measurement.msPerRender > threshold.maxMsPerRender) {
    failures.push(
      `${measurement.label} render time ${measurement.msPerRender.toFixed(4)}ms/render exceeded ${threshold.maxMsPerRender.toFixed(4)}ms/render`
    );
  }
  if (measurement.sqlChars > threshold.maxSqlChars) {
    failures.push(
      `${measurement.label} SQL size ${measurement.sqlChars} chars exceeded ${threshold.maxSqlChars} chars`
    );
  }
}

const postgresqlOptimized = requireMeasurement(byLabel, "postgresql/optimized", failures);
const postgresqlReadable = requireMeasurement(byLabel, "postgresql/readable", failures);
if (postgresqlOptimized && postgresqlReadable) {
  if (postgresqlReadable.sqlChars <= postgresqlOptimized.sqlChars) {
    failures.push(
      `postgresql/readable SQL size ${postgresqlReadable.sqlChars} chars should remain larger than postgresql/optimized ${postgresqlOptimized.sqlChars} chars`
    );
  }
  const slowdown = postgresqlReadable.msPerRender / postgresqlOptimized.msPerRender;
  if (slowdown > RENDER_BENCHMARK_RELATIONS.readableVsOptimizedMaxSlowdown) {
    failures.push(
      `postgresql/readable slowdown ${slowdown.toFixed(2)}x exceeded ${RENDER_BENCHMARK_RELATIONS.readableVsOptimizedMaxSlowdown.toFixed(2)}x`
    );
  }
}

if (failures.length > 0) {
  console.error("Benchmark regression check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Benchmark regression check passed.");

function requireMeasurement(
  byLabel: Map<string, ReturnType<typeof runRenderBenchmark>[number]>,
  label: string,
  failures: string[]
) {
  const measurement = byLabel.get(label);
  if (!measurement) {
    failures.push(`Missing benchmark measurement for ${label}`);
    return null;
  }
  return measurement;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
