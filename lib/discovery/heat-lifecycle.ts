export type HeatLifecycle =
  | "breaking_out"
  | "rising"
  | "sustained_high"
  | "cooling"
  | "emerging";

export type HeatLifecycleInput = {
  publishedAt: Array<string | null>;
  sourceCount: number;
  asOfDate?: string;
};

export type HeatLifecycleResult = {
  state: HeatLifecycle;
  label: string;
  reason: string;
  articleCount24h: number;
  articleCount7d: number;
  articleCount30d: number;
  previous7dCount: number;
  activeDays: number;
  persistenceScore: number;
  velocityRatio: number;
  firstSeenAt: string | null;
};

const DAY_MS = 86400000;

function startOfDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function lifecycleLabel(state: HeatLifecycle) {
  const labels: Record<HeatLifecycle, string> = {
    breaking_out: "短期爆發",
    rising: "持續升溫",
    sustained_high: "持續高熱度",
    cooling: "正在降溫",
    emerging: "早期觀察",
  };
  return labels[state];
}

export function calculateHeatLifecycle(input: HeatLifecycleInput): HeatLifecycleResult {
  const asOf = input.asOfDate
    ? new Date(`${input.asOfDate}T23:59:59.999Z`)
    : new Date();
  const asOfTime = asOf.getTime();
  const dates = input.publishedAt
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()) && value.getTime() <= asOfTime)
    .sort((a, b) => a.getTime() - b.getTime());

  const withinDays = (date: Date, days: number) =>
    date.getTime() > asOfTime - days * DAY_MS;
  const articleCount24h = dates.filter((date) => withinDays(date, 1)).length;
  const articleCount7d = dates.filter((date) => withinDays(date, 7)).length;
  const articleCount30d = dates.filter((date) => withinDays(date, 30)).length;
  const previous7dCount = dates.filter(
    (date) => withinDays(date, 14) && !withinDays(date, 7),
  ).length;
  const activeDays = new Set(
    dates
      .filter((date) => withinDays(date, 30))
      .map((date) => startOfDay(date)),
  ).size;
  const olderDailyAverage = Math.max((articleCount30d - articleCount7d) / 23, 0.25);
  const velocityRatio = Number(((articleCount7d / 7) / olderDailyAverage).toFixed(2));
  const persistenceScore = Math.min(
    100,
    Math.round(
      activeDays * 8 +
      Math.min(articleCount30d, 20) * 2 +
      Math.min(input.sourceCount, 8) * 5,
    ),
  );

  let state: HeatLifecycle = "emerging";
  if (
    articleCount7d >= 6 &&
    articleCount30d >= 10 &&
    activeDays >= 4 &&
    input.sourceCount >= 3 &&
    (previous7dCount >= 3 || articleCount30d >= 14)
  ) {
    state = "sustained_high";
  } else if (
    previous7dCount >= 4 &&
    articleCount7d <= Math.max(1, previous7dCount * 0.5)
  ) {
    state = "cooling";
  } else if (
    articleCount24h >= 3 &&
    (velocityRatio >= 2.5 || articleCount30d === articleCount24h) &&
    input.sourceCount >= 2
  ) {
    state = "breaking_out";
  } else if (
    articleCount7d >= 4 &&
    velocityRatio >= 1.4 &&
    input.sourceCount >= 2
  ) {
    state = "rising";
  }

  const reasons: Record<HeatLifecycle, string> = {
    sustained_high: `近 30 天有 ${articleCount30d} 篇、分布於 ${activeDays} 天，且近兩週持續有跨來源討論。`,
    breaking_out: `近 24 小時新增 ${articleCount24h} 篇，近期速度約為先前基準的 ${velocityRatio} 倍。`,
    rising: `近 7 天有 ${articleCount7d} 篇，討論速度約為先前基準的 ${velocityRatio} 倍。`,
    cooling: `前一個 7 天有 ${previous7dCount} 篇，最近 7 天降至 ${articleCount7d} 篇。`,
    emerging: `目前有 ${articleCount30d} 篇、${input.sourceCount} 個有效來源，仍需更多時間確認。`,
  };

  return {
    state,
    label: lifecycleLabel(state),
    reason: reasons[state],
    articleCount24h,
    articleCount7d,
    articleCount30d,
    previous7dCount,
    activeDays,
    persistenceScore,
    velocityRatio,
    firstSeenAt: dates[0]?.toISOString() ?? null,
  };
}
