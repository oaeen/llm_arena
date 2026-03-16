"use client";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CartesianGrid,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  buildDashboardSummary,
  getMetricAxisConfig,
  isMetricChartValueValid,
  isMetricLogScaled,
  getMetricValue,
  getParetoFrontier,
  scoreModels,
} from "@/lib/scoring";
import type {
  AxisMetric,
  DashboardSnapshot,
  SnapshotModel,
  WeightConfig,
} from "@/lib/types";
import {
  formatCompactNumber,
  formatDateTime,
  formatDecimal,
  formatPrice,
} from "@/lib/formatters";
import {
  formatMetricValue,
  METRIC_LABELS,
  METRIC_OPTIONS,
} from "@/lib/metric-metadata";

const PANEL_CLASS_NAME =
  "rounded-[28px] border border-black/8 bg-white/95 shadow-[0_18px_56px_rgba(15,23,42,0.06)] backdrop-blur";

const DEFAULT_CHARTS = {
  first: {
    xMetric: "blendedPricePerMillion" as AxisMetric,
    yMetric: "rating" as AxisMetric,
    showFrontier: true,
  },
  second: {
    xMetric: "p50LatencyMs" as AxisMetric,
    yMetric: "p50Tps" as AxisMetric,
    showFrontier: true,
  },
};

const PROVIDER_COLORS = [
  "#111827",
  "#334155",
  "#0f766e",
  "#1d4ed8",
  "#166534",
  "#9a3412",
  "#7c3aed",
  "#0369a1",
];

const providerColor = (provider: string) => {
  const hash = provider
    .split("")
    .reduce((accumulator, char) => accumulator + char.charCodeAt(0), 0);
  return PROVIDER_COLORS[hash % PROVIDER_COLORS.length];
};

const limitOptions = [10, 25, 50, 100, 200];

const cardTitleClassName =
  "text-xs font-medium uppercase tracking-[0.2em] text-black/45";

const selectClassName =
  "rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black/25";

const inputClassName =
  "rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-black/25";

const toggleClassName =
  "inline-flex items-center gap-3 rounded-full border border-black/10 bg-black/[0.02] px-4 py-2 text-sm text-black/75";

const MetricCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) => (
  <div className={`${PANEL_CLASS_NAME} p-6`}>
    <div className={cardTitleClassName}>{label}</div>
    <div className="mt-4 text-[2rem] font-semibold tracking-[-0.04em] text-black">
      {value}
    </div>
    <div className="mt-3 text-sm leading-6 text-black/55">{hint}</div>
  </div>
);

const SectionCard = ({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <section className={`${PANEL_CLASS_NAME} min-w-0 p-6 md:p-8`}>
    <div className="flex flex-col gap-4 border-b border-black/6 pb-5 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-black">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">
          {subtitle}
        </p>
      </div>
      {action}
    </div>
    <div className="pt-6">{children}</div>
  </section>
);

const ScatterPanel = ({
  models,
  title,
  subtitle,
  xMetric,
  yMetric,
  onChangeXMetric,
  onChangeYMetric,
  showFrontier,
  onToggleFrontier,
}: {
  models: SnapshotModel[];
  title: string;
  subtitle: string;
  xMetric: AxisMetric;
  yMetric: AxisMetric;
  onChangeXMetric: (metric: AxisMetric) => void;
  onChangeYMetric: (metric: AxisMetric) => void;
  showFrontier: boolean;
  onToggleFrontier: (nextValue: boolean) => void;
}) => {
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const chartContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = chartContainerRef.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextEntry = entries[0];
      const nextWidth = Math.floor(nextEntry?.contentRect.width ?? 0);
      const nextHeight = Math.floor(nextEntry?.contentRect.height ?? 0);
      setChartSize({ width: nextWidth, height: nextHeight });
    });

    observer.observe(container);
    setChartSize({
      width: container.clientWidth,
      height: container.clientHeight,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const data = models
    .map((model) => {
      const x = getMetricValue(model, xMetric);
      const y = getMetricValue(model, yMetric);

      if (
        !isMetricChartValueValid(xMetric, x) ||
        !isMetricChartValueValid(yMetric, y)
      ) {
        return null;
      }

      return {
        id: model.id,
        label: model.displayName,
        provider: model.provider,
        rank: model.arena.rank,
        color: providerColor(model.provider),
        x,
        y,
        z: Math.max(model.arena.contextLength ?? 8_192, 8_192),
        model,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const frontier = getParetoFrontier(models, xMetric, yMetric)
    .map((model) => ({
      id: model.id,
      x: getMetricValue(model, xMetric),
      y: getMetricValue(model, yMetric),
      z: Math.max(model.arena.contextLength ?? 8_192, 8_192),
    }))
    .filter(
      (entry): entry is { id: string; x: number; y: number; z: number } =>
        isMetricChartValueValid(xMetric, entry.x) &&
        isMetricChartValueValid(yMetric, entry.y),
    )
    .sort((left, right) => left.x - right.x);
  const xAxisConfig = getMetricAxisConfig(models, xMetric);
  const yAxisConfig = getMetricAxisConfig(models, yMetric);

  return (
    <SectionCard
      title={title}
      subtitle={subtitle}
      action={
        <label className={toggleClassName}>
          <input
            checked={showFrontier}
            onChange={(event) => onToggleFrontier(event.target.checked)}
            type="checkbox"
          />
          Pareto frontier
        </label>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-black/55">
          X 轴
          <select
            className={selectClassName}
            onChange={(event) =>
              onChangeXMetric(event.target.value as AxisMetric)
            }
            value={xMetric}
          >
            {METRIC_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm text-black/55">
          Y 轴
          <select
            className={selectClassName}
            onChange={(event) =>
              onChangeYMetric(event.target.value as AxisMetric)
            }
            value={yMetric}
          >
            {METRIC_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isMetricLogScaled(xMetric) || isMetricLogScaled(yMetric) ? (
        <div className="mt-4 rounded-2xl border border-black/8 bg-black/[0.02] px-4 py-3 text-sm text-black/55">
          输入价格、输出价格和综合价格在图表中使用 log 坐标。价格为 0
          的模型不会显示在对应坐标轴的图里。
        </div>
      ) : null}

      <div className="mt-6 h-[360px] min-w-0" ref={chartContainerRef}>
        {chartSize.width <= 0 || chartSize.height <= 0 ? (
          <div className="flex h-full items-center justify-center rounded-[24px] border border-black/8 bg-black/[0.02] text-sm text-black/45">
            正在准备图表…
          </div>
        ) : (
          <ScatterChart
            height={chartSize.height}
            margin={{ top: 18, right: 18, bottom: 12, left: 8 }}
            width={chartSize.width}
          >
            <CartesianGrid stroke="rgba(15,23,42,0.08)" vertical={false} />
            <XAxis
              dataKey="x"
              domain={xAxisConfig.domain}
              name={METRIC_LABELS[xMetric]}
              scale={xAxisConfig.scale}
              stroke="rgba(15,23,42,0.45)"
              tickFormatter={(value) =>
                formatMetricValue(xMetric, Number(value))
              }
              ticks={xAxisConfig.ticks}
              type="number"
            />
            <YAxis
              dataKey="y"
              domain={yAxisConfig.domain}
              name={METRIC_LABELS[yMetric]}
              scale={yAxisConfig.scale}
              stroke="rgba(15,23,42,0.45)"
              tickFormatter={(value) =>
                formatMetricValue(yMetric, Number(value))
              }
              ticks={yAxisConfig.ticks}
              type="number"
            />
            <ZAxis dataKey="z" range={[72, 240]} />
            <Tooltip
              cursor={{ stroke: "rgba(17,24,39,0.15)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) {
                  return null;
                }

                const current = payload[0]?.payload as {
                  label: string;
                  provider: string;
                  rank: number;
                  x: number;
                  y: number;
                  model: SnapshotModel;
                };

                return (
                  <div className="max-w-xs rounded-3xl border border-black/10 bg-white p-4 shadow-2xl">
                    <div className="text-base font-semibold text-black">
                      {current.label}
                    </div>
                    <div className="mt-1 text-sm text-black/55">
                      #{current.rank} · {current.provider}
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-black/70">
                      <div>
                        {METRIC_LABELS[xMetric]}：
                        {formatMetricValue(xMetric, current.x)}
                      </div>
                      <div>
                        {METRIC_LABELS[yMetric]}：
                        {formatMetricValue(yMetric, current.y)}
                      </div>
                      <div>
                        综合评分：
                        {formatMetricValue(
                          "compositeScore",
                          current.model.derived.compositeScore,
                        )}
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            {showFrontier && frontier.length >= 2 ? (
              <Scatter
                data={frontier}
                fill="transparent"
                isAnimationActive={false}
                line={{ stroke: "#111827", strokeWidth: 1.5 }}
                shape={() => null}
              />
            ) : null}
            <Scatter
              data={data}
              isAnimationActive={false}
              shape={(properties: {
                cx?: number;
                cy?: number;
                size?: number;
                payload?: { color: string };
              }) => {
                const radius = Math.max((properties.size ?? 0) / 16, 5);
                return (
                  <circle
                    cx={properties.cx}
                    cy={properties.cy}
                    fill={properties.payload?.color ?? "#111827"}
                    fillOpacity={0.72}
                    r={radius}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth={1.5}
                  />
                );
              }}
            />
          </ScatterChart>
        )}
      </div>
    </SectionCard>
  );
};

export const DashboardPage = ({
  snapshot,
  initialLimit,
}: {
  snapshot: DashboardSnapshot;
  initialLimit: number;
}) => {
  const [limit, setLimit] = useState(initialLimit);
  const [showComparableOnly, setShowComparableOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [weights, setWeights] = useState<WeightConfig>({
    capability: 45,
    price: 25,
    latency: 20,
    throughput: 10,
  });
  const [firstChart, setFirstChart] = useState(DEFAULT_CHARTS.first);
  const [secondChart, setSecondChart] = useState(DEFAULT_CHARTS.second);
  const deferredSearch = useDeferredValue(search);

  const rescoredModels = scoreModels(snapshot.models, weights);
  const normalizedSearch = deferredSearch.trim().toLowerCase();
  const filteredModels = rescoredModels.filter((model) => {
    if (showComparableOnly && !model.derived.comparable) {
      return false;
    }

    if (!normalizedSearch) {
      return true;
    }

    return (
      model.displayName.toLowerCase().includes(normalizedSearch) ||
      model.provider.toLowerCase().includes(normalizedSearch)
    );
  });

  const visibleModels = filteredModels.slice(
    0,
    limit === Number.MAX_SAFE_INTEGER ? filteredModels.length : limit,
  );
  const summary = buildDashboardSummary(rescoredModels);
  const visibleComparableCount = visibleModels.filter(
    (model) => model.derived.comparable,
  ).length;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-10">
      <section>
        <div className={`${PANEL_CLASS_NAME} p-8 md:p-10`}>
          <div className="text-xs font-medium uppercase tracking-[0.28em] text-black/45">
            LLM Arena 综合性能看板
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-0.055em] text-black md:text-6xl">
            把 Arena 排名、OpenRouter 价格和真实延迟放到同一张白纸上比较。
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-black/58 md:text-lg">
            默认口径来自 LMArena Text / Overall（无 style control），价格优先取
            OpenRouter catalog，延迟与 TPS 取 OpenRouter endpoint
            stats。首页默认展示本地快照，用来稳定比较不同模型的综合表现。
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-black/55">
            <span className="rounded-full border border-black/10 bg-black/[0.02] px-4 py-2">
              最新刷新：{formatDateTime(snapshot.meta.refreshedAt)}
            </span>
            <span className="rounded-full border border-black/10 bg-black/[0.02] px-4 py-2">
              榜单口径：{snapshot.meta.leaderboardSlug}
            </span>
            <span className="rounded-full border border-black/10 bg-black/[0.02] px-4 py-2">
              Stats 覆盖：{snapshot.meta.statsCoverageCount}/
              {snapshot.meta.totalModels}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          hint="当前快照里的全部文本模型数量。"
          label="总模型数"
          value={formatCompactNumber(snapshot.meta.totalModels)}
        />
        <MetricCard
          hint="具备 rating、price、latency、TPS 全量指标的模型。"
          label="可完整比较"
          value={formatCompactNumber(summary.comparableModels)}
        />
        <MetricCard
          hint="OpenRouter endpoint stats 至少拿到 p50 latency 和 p50 TPS 的模型数。"
          label="性能覆盖"
          value={formatCompactNumber(snapshot.meta.statsCoverageCount)}
        />
        <MetricCard
          hint="当前快照中最优模型的 Arena rating。"
          label="最高 Arena 评分"
          value={formatDecimal(summary.bestArenaRating)}
        />
      </section>

      <section className={`${PANEL_CLASS_NAME} mt-6 p-6 md:p-8`}>
        <div className="flex flex-col gap-6 border-b border-black/6 pb-6">
          <div>
            <div className="text-2xl font-semibold tracking-[-0.04em] text-black">
              过滤与综合评分
            </div>
            <p className="mt-2 text-sm leading-6 text-black/55">
              综合评分不是唯一真相，它只是把能力、价格、延迟和 TPS
              压成一个可调权重视图。 你仍然可以直接看原始指标与 Pareto
              frontier。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-sm text-black/55">
              搜索模型
              <input
                className={inputClassName}
                onChange={(event) => {
                  startTransition(() => {
                    setSearch(event.target.value);
                  });
                }}
                placeholder="例如 claude / gemini / deepseek"
                type="search"
                value={search}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-black/55">
              展示 Top N
              <select
                className={selectClassName}
                onChange={(event) => {
                  startTransition(() => {
                    const nextLimit = Number.parseInt(event.target.value, 10);
                    setLimit(
                      Number.isFinite(nextLimit) ? nextLimit : initialLimit,
                    );
                  });
                }}
                value={limit}
              >
                {limitOptions.map((option) => (
                  <option key={option} value={option}>
                    Top {option}
                  </option>
                ))}
                <option value={Number.MAX_SAFE_INTEGER}>全部</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm text-black/55">
              当前可见模型
              <div className="rounded-2xl border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-black">
                {visibleModels.length} 个，其中 {visibleComparableCount}{" "}
                个可完整比较
              </div>
            </label>

            <label className={`${toggleClassName} justify-between`}>
              <span>仅显示完整指标模型</span>
              <input
                checked={showComparableOnly}
                onChange={(event) => {
                  startTransition(() => {
                    setShowComparableOnly(event.target.checked);
                  });
                }}
                type="checkbox"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {(
            [
              ["capability", "能力", weights.capability],
              ["price", "价格", weights.price],
              ["latency", "延迟", weights.latency],
              ["throughput", "TPS", weights.throughput],
            ] as const
          ).map(([key, label, value]) => (
            <label
              key={key}
              className="rounded-[24px] border border-black/8 bg-black/[0.02] p-4"
            >
              <div className="flex items-center justify-between text-sm text-black/55">
                <span>{label}权重</span>
                <span className="font-medium text-black">{value}</span>
              </div>
              <input
                className="mt-4 w-full accent-black"
                max={100}
                min={0}
                onChange={(event) => {
                  startTransition(() => {
                    setWeights((current) => ({
                      ...current,
                      [key]: Number.parseInt(event.target.value, 10),
                    }));
                  });
                }}
                type="range"
                value={value}
              />
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-black/55">
          <button
            className="rounded-full border border-black/10 px-4 py-2 transition hover:bg-black hover:text-white"
            onClick={() => {
              startTransition(() => {
                setWeights({
                  capability: 45,
                  price: 25,
                  latency: 20,
                  throughput: 10,
                });
              });
            }}
            type="button"
          >
            重置默认权重
          </button>
          <span>当前结果默认按 Arena 原始排名展示，综合评分用于辅助比较。</span>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <ScatterPanel
          models={visibleModels}
          onChangeXMetric={(metric) =>
            startTransition(() => {
              setFirstChart((current) => ({ ...current, xMetric: metric }));
            })
          }
          onChangeYMetric={(metric) =>
            startTransition(() => {
              setFirstChart((current) => ({ ...current, yMetric: metric }));
            })
          }
          onToggleFrontier={(nextValue) =>
            startTransition(() => {
              setFirstChart((current) => ({
                ...current,
                showFrontier: nextValue,
              }));
            })
          }
          showFrontier={firstChart.showFrontier}
          subtitle="默认看综合价格与 Arena rating，回答“强不强且值不值”。Pareto frontier 会标出当前筛选条件下的非支配模型。"
          title="能力 / 价格"
          xMetric={firstChart.xMetric}
          yMetric={firstChart.yMetric}
        />

        <ScatterPanel
          models={visibleModels}
          onChangeXMetric={(metric) =>
            startTransition(() => {
              setSecondChart((current) => ({ ...current, xMetric: metric }));
            })
          }
          onChangeYMetric={(metric) =>
            startTransition(() => {
              setSecondChart((current) => ({ ...current, yMetric: metric }));
            })
          }
          onToggleFrontier={(nextValue) =>
            startTransition(() => {
              setSecondChart((current) => ({
                ...current,
                showFrontier: nextValue,
              }));
            })
          }
          showFrontier={secondChart.showFrontier}
          subtitle="默认看 P50 latency 与 P50 TPS，气泡大小对应 context length，回答“快不快且稳不稳”。"
          title="延迟 / 吞吐"
          xMetric={secondChart.xMetric}
          yMetric={secondChart.yMetric}
        />
      </section>

      <SectionCard
        action={
          <div className="text-sm text-black/55">
            中位综合价格：{formatPrice(summary.medianBlendedPrice)}
          </div>
        }
        subtitle="表格保留 Arena 原始排序，同时把价格、延迟、TPS 和综合评分放在同一行，便于快速横向判断。"
        title="模型对照表"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-black/42">
                <th className="pb-3 pr-4">Rank</th>
                <th className="pb-3 pr-4">Model</th>
                <th className="pb-3 pr-4">Arena</th>
                <th className="pb-3 pr-4">Input</th>
                <th className="pb-3 pr-4">Output</th>
                <th className="pb-3 pr-4">Latency</th>
                <th className="pb-3 pr-4">TPS</th>
                <th className="pb-3 pr-4">Composite</th>
                <th className="pb-3">Match</th>
              </tr>
            </thead>
            <tbody>
              {visibleModels.map((model) => (
                <tr
                  key={model.id}
                  className="rounded-[22px] border border-black/6 bg-black/[0.015] text-sm text-black/72"
                >
                  <td className="rounded-l-[22px] px-4 py-4 font-medium text-black">
                    #{model.arena.rank}
                  </td>
                  <td className="px-4 py-4">
                    <div className="min-w-[220px]">
                      <div className="font-medium text-black">
                        {model.modelUrl ? (
                          <a
                            className="transition hover:text-black/65"
                            href={model.modelUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {model.displayName}
                          </a>
                        ) : (
                          model.displayName
                        )}
                      </div>
                      <div className="mt-1 text-xs text-black/45">
                        {model.provider} · {model.license ?? "Unknown"}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {formatDecimal(model.arena.rating)}
                  </td>
                  <td className="px-4 py-4">
                    {formatPrice(model.pricing.inputPerMillion)}
                  </td>
                  <td className="px-4 py-4">
                    {formatPrice(model.pricing.outputPerMillion)}
                  </td>
                  <td className="px-4 py-4">
                    {formatDecimal(model.perf.p50LatencyMs, " ms")}
                  </td>
                  <td className="px-4 py-4">
                    {formatDecimal(model.perf.p50Tps, " tok/s")}
                  </td>
                  <td className="px-4 py-4 font-medium text-black">
                    {formatDecimal(model.derived.compositeScore)}
                  </td>
                  <td className="rounded-r-[22px] px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/65">
                        {model.match.status === "matched"
                          ? `${model.match.matchType} · ${Math.round(
                              model.match.confidence * 100,
                            )}%`
                          : "unmatched"}
                      </span>
                      <span className="text-xs text-black/45">
                        {model.pricing.source === "openrouter"
                          ? "价格来自 OpenRouter"
                          : model.pricing.source === "arena"
                            ? "价格回退到 Arena"
                            : "价格缺失"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </main>
  );
};
