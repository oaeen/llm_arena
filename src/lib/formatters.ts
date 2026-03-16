const compactFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const decimalFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});

export const formatCompactNumber = (value: number | null) =>
  value === null ? "N/A" : compactFormatter.format(value);

export const formatDecimal = (value: number | null, suffix = "") =>
  value === null ? "N/A" : `${decimalFormatter.format(value)}${suffix}`;

export const formatPrice = (value: number | null) =>
  value === null ? "N/A" : `$${decimalFormatter.format(value)}/1M`;

export const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "N/A";
