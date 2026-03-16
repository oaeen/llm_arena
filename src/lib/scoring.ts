import type {
  AxisMetric,
  DashboardSummary,
  SnapshotModel,
  WeightConfig,
} from "@/lib/types";
import { blendPricePerMillion, median } from "@/lib/utils";

export const DEFAULT_WEIGHTS: WeightConfig = {
  capability: 45,
  price: 25,
  latency: 20,
  throughput: 10,
};

const metricDirection: Record<AxisMetric, "higher" | "lower"> = {
  rating: "higher",
  inputPricePerMillion: "lower",
  outputPricePerMillion: "lower",
  blendedPricePerMillion: "lower",
  p50LatencyMs: "lower",
  p50Tps: "higher",
  contextLength: "higher",
  compositeScore: "higher",
};

const LOG_SCALE_METRICS = new Set<AxisMetric>([
  "inputPricePerMillion",
  "outputPricePerMillion",
  "blendedPricePerMillion",
]);

const logTransform = (value: number | null) =>
  value === null || value <= 0 ? null : Math.log10(value);

const percentileScore = (
  values: number[],
  currentValue: number | null,
  direction: "higher" | "lower",
) => {
  if (currentValue === null || values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const smallerCount = sorted.filter((value) => value < currentValue).length;
  const equalCount = sorted.filter((value) => value === currentValue).length;
  const percentile =
    sorted.length === 1
      ? 1
      : (smallerCount + Math.max(equalCount - 1, 0) / 2) / (sorted.length - 1);

  const baseScore = percentile * 100;
  const finalScore = direction === "higher" ? baseScore : 100 - baseScore;
  return Number(finalScore.toFixed(2));
};

const metricCollections = (models: SnapshotModel[]) => {
  const ratings = models.map((model) => model.arena.rating);
  const blendedPrices = models
    .map((model) => logTransform(model.pricing.blendedPerMillion))
    .filter((value): value is number => value !== null);
  const latencies = models
    .map((model) => logTransform(model.perf.p50LatencyMs))
    .filter((value): value is number => value !== null);
  const throughputs = models
    .map((model) => logTransform(model.perf.p50Tps))
    .filter((value): value is number => value !== null);

  return {
    ratings,
    blendedPrices,
    latencies,
    throughputs,
  };
};

export const scoreModels = (
  models: SnapshotModel[],
  weights: WeightConfig = DEFAULT_WEIGHTS,
) => {
  const { ratings, blendedPrices, latencies, throughputs } =
    metricCollections(models);
  const totalWeight =
    weights.capability + weights.price + weights.latency + weights.throughput;

  return models.map((model) => {
    const capabilityScore = percentileScore(
      ratings,
      model.arena.rating,
      "higher",
    );
    const priceScore = percentileScore(
      blendedPrices,
      logTransform(model.pricing.blendedPerMillion),
      "lower",
    );
    const latencyScore = percentileScore(
      latencies,
      logTransform(model.perf.p50LatencyMs),
      "lower",
    );
    const throughputScore = percentileScore(
      throughputs,
      logTransform(model.perf.p50Tps),
      "higher",
    );

    const comparable =
      capabilityScore !== null &&
      priceScore !== null &&
      latencyScore !== null &&
      throughputScore !== null;

    const compositeScore = comparable
      ? Number(
          (
            (capabilityScore * weights.capability +
              priceScore * weights.price +
              latencyScore * weights.latency +
              throughputScore * weights.throughput) /
            totalWeight
          ).toFixed(2),
        )
      : null;

    return {
      ...model,
      derived: {
        capabilityScore,
        priceScore,
        latencyScore,
        throughputScore,
        compositeScore,
        comparable,
      },
      pricing: {
        ...model.pricing,
        blendedPerMillion: blendPricePerMillion(
          model.pricing.inputPerMillion,
          model.pricing.outputPerMillion,
        ),
      },
    };
  });
};

export const getMetricValue = (model: SnapshotModel, metric: AxisMetric) => {
  switch (metric) {
    case "rating":
      return model.arena.rating;
    case "inputPricePerMillion":
      return model.pricing.inputPerMillion;
    case "outputPricePerMillion":
      return model.pricing.outputPerMillion;
    case "blendedPricePerMillion":
      return model.pricing.blendedPerMillion;
    case "p50LatencyMs":
      return model.perf.p50LatencyMs;
    case "p50Tps":
      return model.perf.p50Tps;
    case "contextLength":
      return model.arena.contextLength;
    case "compositeScore":
      return model.derived.compositeScore;
    default:
      return null;
  }
};

export const getMetricDirection = (metric: AxisMetric) =>
  metricDirection[metric];

export const isMetricLogScaled = (metric: AxisMetric) =>
  LOG_SCALE_METRICS.has(metric);

export const isMetricChartValueValid = (
  metric: AxisMetric,
  value: number | null,
) => value !== null && (!isMetricLogScaled(metric) || value > 0);

export const getMetricAxisConfig = (
  models: SnapshotModel[],
  metric: AxisMetric,
) => {
  if (metric === "rating") {
    const values = models
      .map((model) => getMetricValue(model, metric))
      .filter((value): value is number => value !== null);

    if (values.length === 0) {
      return {
        domain: undefined,
        ticks: undefined,
        scale: undefined,
      };
    }

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const lowerBound = Math.floor(minimum / 100) * 100;
    const roundedUpperBound = Math.ceil(maximum / 100) * 100;
    const upperBound =
      roundedUpperBound === lowerBound ? lowerBound + 100 : roundedUpperBound;
    const ticks: number[] = [];

    for (let tick = lowerBound; tick <= upperBound; tick += 100) {
      ticks.push(tick);
    }

    return {
      domain: [lowerBound, upperBound] as [number, number],
      ticks,
      scale: undefined,
    };
  }

  if (!isMetricLogScaled(metric)) {
    return {
      domain: undefined,
      ticks: undefined,
      scale: undefined,
    };
  }

  const values = models
    .map((model) => getMetricValue(model, metric))
    .filter((value): value is number => isMetricChartValueValid(metric, value));

  if (values.length === 0) {
    return {
      domain: undefined,
      ticks: undefined,
      scale: "log" as const,
    };
  }

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const minimumExponent = Math.floor(Math.log10(minimum));
  const maximumExponent = Math.ceil(Math.log10(maximum));
  const lowerBound = 10 ** minimumExponent;
  const upperBound =
    minimumExponent === maximumExponent
      ? 10 ** (maximumExponent + 1)
      : 10 ** maximumExponent;
  const ticks: number[] = [];

  for (
    let exponent = minimumExponent;
    exponent <= Math.log10(upperBound);
    exponent += 1
  ) {
    ticks.push(10 ** exponent);
  }

  return {
    domain: [lowerBound, upperBound] as [number, number],
    ticks,
    scale: "log" as const,
  };
};

export const buildDashboardSummary = (
  models: SnapshotModel[],
): DashboardSummary => {
  const comparableModels = models.filter((model) => model.derived.comparable);

  return {
    totalModels: models.length,
    comparableModels: comparableModels.length,
    unmatchedModels: models.filter(
      (model) => model.match.status === "unmatched",
    ).length,
    bestArenaRating:
      models.length > 0
        ? Math.max(...models.map((model) => model.arena.rating))
        : null,
    medianBlendedPrice: median(
      models
        .map((model) => model.pricing.blendedPerMillion)
        .filter((value): value is number => value !== null),
    ),
    medianLatencyMs: median(
      comparableModels
        .map((model) => model.perf.p50LatencyMs)
        .filter((value): value is number => value !== null),
    ),
    medianTps: median(
      comparableModels
        .map((model) => model.perf.p50Tps)
        .filter((value): value is number => value !== null),
    ),
  };
};

export const getParetoFrontier = (
  models: SnapshotModel[],
  xMetric: AxisMetric,
  yMetric: AxisMetric,
) => {
  const candidates = models.filter((model) => {
    const x = getMetricValue(model, xMetric);
    const y = getMetricValue(model, yMetric);
    return x !== null && y !== null;
  });

  return candidates.filter((candidate) => {
    const candidateX = getMetricValue(candidate, xMetric) ?? 0;
    const candidateY = getMetricValue(candidate, yMetric) ?? 0;

    return !candidates.some((other) => {
      if (other.id === candidate.id) {
        return false;
      }

      const otherX = getMetricValue(other, xMetric) ?? 0;
      const otherY = getMetricValue(other, yMetric) ?? 0;
      const xBetter =
        getMetricDirection(xMetric) === "higher"
          ? otherX >= candidateX
          : otherX <= candidateX;
      const yBetter =
        getMetricDirection(yMetric) === "higher"
          ? otherY >= candidateY
          : otherY <= candidateY;
      const strictlyBetter = otherX !== candidateX || otherY !== candidateY;

      return xBetter && yBetter && strictlyBetter;
    });
  });
};
