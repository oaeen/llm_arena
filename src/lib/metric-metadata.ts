import type { AxisMetric } from "@/lib/types";
import {
  formatCompactNumber,
  formatDecimal,
  formatPrice,
} from "@/lib/formatters";

export const METRIC_LABELS: Record<AxisMetric, string> = {
  rating: "Arena 评分",
  inputPricePerMillion: "输入价格",
  outputPricePerMillion: "输出价格",
  blendedPricePerMillion: "综合价格",
  p50LatencyMs: "P50 延迟",
  p50Tps: "P50 TPS",
  contextLength: "上下文长度",
  compositeScore: "综合评分",
};

export const formatMetricValue = (
  metric: AxisMetric,
  value: number | null | undefined,
) => {
  if (value === null || value === undefined) {
    return "N/A";
  }

  switch (metric) {
    case "rating":
      return formatDecimal(value);
    case "inputPricePerMillion":
    case "outputPricePerMillion":
    case "blendedPricePerMillion":
      return formatPrice(value);
    case "p50LatencyMs":
      return formatDecimal(value, " ms");
    case "p50Tps":
      return formatDecimal(value, " tok/s");
    case "contextLength":
      return formatCompactNumber(value);
    case "compositeScore":
      return formatDecimal(value, " 分");
    default:
      return formatDecimal(value);
  }
};

export const METRIC_OPTIONS: Array<{
  value: AxisMetric;
  label: string;
}> = [
  { value: "rating", label: METRIC_LABELS.rating },
  { value: "inputPricePerMillion", label: METRIC_LABELS.inputPricePerMillion },
  {
    value: "outputPricePerMillion",
    label: METRIC_LABELS.outputPricePerMillion,
  },
  {
    value: "blendedPricePerMillion",
    label: METRIC_LABELS.blendedPricePerMillion,
  },
  { value: "p50LatencyMs", label: METRIC_LABELS.p50LatencyMs },
  { value: "p50Tps", label: METRIC_LABELS.p50Tps },
  { value: "contextLength", label: METRIC_LABELS.contextLength },
  { value: "compositeScore", label: METRIC_LABELS.compositeScore },
];
