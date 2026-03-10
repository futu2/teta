import {
  formatRenderBenchmarkMeasurement,
  runRenderBenchmark,
} from "./render_shared.ts";

const runs = parsePositiveInteger(process.env.TETA_BENCH_RUNS, 1000);
const warmupRuns = parsePositiveInteger(process.env.TETA_BENCH_WARMUP_RUNS, 200);
const samples = parsePositiveInteger(process.env.TETA_BENCH_SAMPLES, 5);

const measurements = runRenderBenchmark({ runs, warmupRuns, samples });
for (const measurement of measurements) {
  console.log(formatRenderBenchmarkMeasurement(measurement));
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
