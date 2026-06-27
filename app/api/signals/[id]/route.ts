import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getSignalReturnDetails } from "@/lib/signals/backtest";
import { getCurrentMonthlySignals } from "@/lib/signals/monthly-signals";
import { publishableLatestPrice } from "@/lib/signals/price-quality";
import {
  derivedEvidenceItems,
  derivedLessons,
  derivedTimelineEvents,
  emptyStockReturnDetails,
  getDerivedSignalById,
  pendingOutcomes,
} from "@/lib/signals/derived-signals";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SignalRow = {
  id: string;
  signal_date: string;
  as_of_date: string;
  topic: string;
  signal_type: string;
  signal_strength: number;
  confidence_score: number;
  hypothesis: string;
  evidence: unknown[];
  status: string;
  model_version: string | null;
};

type WatchlistRow = {
  id: string;
  signal_event_id: string;
  symbol: string;
  company_name: string;
  market: string;
  thesis: string;
  weight: number;
  source: string | null;
};

type PriceRow = {
  symbol: string;
  market: string;
  price_date: string;
  close: number;
  adj_close: number | null;
  volume: number | null;
  quality_status: string | null;
  provider: string | null;
  source_url: string | null;
};

type OutcomeRow = {
  signal_event_id: string;
  horizon_days: number;
  basket_return: number;
  benchmark_return: number;
  excess_return: number;
  outcome: string;
  details: unknown[];
};

type EvidenceItemRow = {
  id: string;
  signal_event_id: string;
  evidence_date: string | null;
  source_name: string | null;
  source_url: string | null;
  source_type: string;
  title: string;
  summary: string | null;
  why_it_matters: string | null;
  known_at_signal_time: boolean;
};

type TimelineEventRow = {
  id: string;
  signal_event_id: string;
  event_date: string | null;
  event_type: string;
  title: string;
  description: string | null;
  source_url: string | null;
  known_at_signal_time: boolean;
  display_order: number;
};

type LessonRow = {
  id: string;
  signal_event_id: string;
  lesson_type: string;
  title: string;
  description: string | null;
  impact: string | null;
};

type ScoreComponentRow = {
  signal_event_id: string;
  component_name: string;
  raw_value: number;
  normalized_score: number;
  weight: number;
  contribution: number;
  calculation_version: string;
  input_snapshot: Record<string, unknown>;
  calculated_at: string;
};

function lastDayOfMonth(month: string) {
  const date = new Date(`${month}-01T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
}

function currentTaipeiDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function getMonthlySignalDetail(id: string) {
  const match = /^monthly-(\d{4}-\d{2})-/.exec(id);
  if (!match) return null;

  const month = match[1];
  const today = currentTaipeiDate();
  const asOfDate = month === today.slice(0, 7) ? today : lastDayOfMonth(month);
  const signals = await getCurrentMonthlySignals(asOfDate);
  return signals.find((signal) => signal.id === id) ?? null;
}

async function readCaseStudyParts(supabase: ReturnType<typeof getSupabaseAdmin>, id: string) {
  const [evidenceResult, timelineResult, lessonsResult, scoreComponentsResult] = await Promise.all([
    supabase
      .from("signal_evidence_items")
      .select("id, signal_event_id, evidence_date, source_name, source_url, source_type, title, summary, why_it_matters, known_at_signal_time")
      .eq("signal_event_id", id)
      .order("evidence_date", { ascending: true })
      .returns<EvidenceItemRow[]>(),
    supabase
      .from("signal_timeline_events")
      .select("id, signal_event_id, event_date, event_type, title, description, source_url, known_at_signal_time, display_order")
      .eq("signal_event_id", id)
      .order("display_order", { ascending: true })
      .returns<TimelineEventRow[]>(),
    supabase
      .from("signal_lessons")
      .select("id, signal_event_id, lesson_type, title, description, impact")
      .eq("signal_event_id", id)
      .order("created_at", { ascending: true })
      .returns<LessonRow[]>(),
    supabase
      .from("signal_score_components")
      .select("signal_event_id, component_name, raw_value, normalized_score, weight, contribution, calculation_version, input_snapshot, calculated_at")
      .eq("signal_event_id", id)
      .order("contribution", { ascending: false })
      .returns<ScoreComponentRow[]>(),
  ]);

  return {
    evidenceItems: evidenceResult.error ? [] : evidenceResult.data ?? [],
    timelineEvents: timelineResult.error ? [] : timelineResult.data ?? [],
    lessons: lessonsResult.error ? [] : lessonsResult.data ?? [],
    scoreComponents: scoreComponentsResult.error ? [] : scoreComponentsResult.data ?? [],
  };
}

function mapEvidenceItem(item: EvidenceItemRow) {
  return {
    id: item.id,
    signalEventId: item.signal_event_id,
    evidenceDate: item.evidence_date ?? undefined,
    sourceName: item.source_name ?? undefined,
    sourceUrl: item.source_url ?? undefined,
    sourceType: item.source_type,
    title: item.title,
    summary: item.summary ?? undefined,
    whyItMatters: item.why_it_matters ?? undefined,
    knownAtSignalTime: item.known_at_signal_time,
  };
}

function mapTimelineEvent(item: TimelineEventRow) {
  return {
    id: item.id,
    signalEventId: item.signal_event_id,
    eventDate: item.event_date ?? undefined,
    eventType: item.event_type,
    title: item.title,
    description: item.description ?? undefined,
    sourceUrl: item.source_url ?? undefined,
    knownAtSignalTime: item.known_at_signal_time,
    displayOrder: Number(item.display_order),
  };
}

function mapLesson(item: LessonRow) {
  return {
    id: item.id,
    signalEventId: item.signal_event_id,
    lessonType: item.lesson_type,
    title: item.title,
    description: item.description ?? undefined,
    impact: item.impact ?? undefined,
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  try {
    const supabase = getSupabaseAdmin();
    const [{ data: signalRows, error: signalError }, { data: watchlists, error: watchlistError }, { data: outcomes, error: outcomeError }] =
      await Promise.all([
        supabase
          .from("signal_events")
          .select("id, signal_date, as_of_date, topic, signal_type, signal_strength, confidence_score, hypothesis, evidence, status, model_version")
          .eq("id", id)
          .limit(1)
          .returns<SignalRow[]>(),
        supabase
          .from("signal_watchlists")
          .select("id, signal_event_id, symbol, company_name, market, thesis, weight, source")
          .eq("signal_event_id", id)
          .order("weight", { ascending: false })
          .returns<WatchlistRow[]>(),
        supabase
          .from("signal_outcomes")
          .select("signal_event_id, horizon_days, basket_return, benchmark_return, excess_return, outcome, details")
          .eq("signal_event_id", id)
          .order("horizon_days", { ascending: true })
          .returns<OutcomeRow[]>(),
      ]);

    if (signalError) throw signalError;
    if (watchlistError) throw watchlistError;
    if (outcomeError) throw outcomeError;

    const signal = signalRows?.[0];
    if (!signal) throw new Error("Signal not found in signal tables");

    const symbols = [...new Set((watchlists ?? []).map((item) => item.symbol))];
    const markets = [...new Set((watchlists ?? []).map((item) => item.market))];
    const { data: prices, error: pricesError } =
      symbols.length > 0
        ? await supabase
            .from("stock_prices")
            .select("symbol, market, price_date, close, adj_close, volume, quality_status, provider, source_url")
            .in("symbol", symbols)
            .in("market", markets)
            .eq("quality_status", "verified")
            .order("price_date", { ascending: false })
            .limit(5000)
            .returns<PriceRow[]>()
        : { data: [] as PriceRow[], error: null };

    if (pricesError) throw pricesError;

    const latestPrices = new Map<string, PriceRow>();
    for (const item of prices ?? []) {
      const key = `${item.symbol}::${item.market}`;
      if (!latestPrices.has(key)) latestPrices.set(key, item);
    }

    const horizons = [7, 14, 30, 60];
    const [stockReturnDetails, caseStudyParts] = await Promise.all([
      Promise.all(
      horizons.map(async (horizonDays) => {
        const result = await getSignalReturnDetails(id, horizonDays);
        return { horizonDays, details: result.details, basketReturn: result.basketReturn };
      }),
      ),
      readCaseStudyParts(supabase, id),
    ]);

    return NextResponse.json({
      ok: true,
      source: "signal_tables",
      signal: {
        id: signal.id,
        signalDate: signal.signal_date,
        asOfDate: signal.as_of_date,
        topic: signal.topic,
        signalType: signal.signal_type,
        signalStrength: Number(signal.signal_strength),
        confidenceScore: Number(signal.confidence_score),
        hypothesis: signal.hypothesis,
        evidence: signal.evidence,
        status: signal.status,
        modelVersion: signal.model_version,
      },
      watchlists: (watchlists ?? []).map((item) => {
        const latestPrice = latestPrices.get(`${item.symbol}::${item.market}`);
        const rawLatestPrice = latestPrice
          ? {
              priceDate: latestPrice.price_date,
              close: Number(latestPrice.close),
              adjClose: latestPrice.adj_close === null ? null : Number(latestPrice.adj_close),
              volume: latestPrice.volume === null ? null : Number(latestPrice.volume),
              qualityStatus: latestPrice.quality_status,
              provider: latestPrice.provider,
              sourceUrl: latestPrice.source_url,
            }
          : null;
        const publishable = publishableLatestPrice(item.symbol, item.market, rawLatestPrice);

        return {
          id: item.id,
          signalEventId: item.signal_event_id,
          symbol: item.symbol,
          companyName: item.company_name,
          market: item.market,
          thesis: item.thesis,
          weight: Number(item.weight),
          source: item.source,
          latestPrice: publishable.latestPrice,
          priceQuality: publishable.priceQuality,
        };
      }),
      outcomes: outcomes ?? [],
      stockReturnDetails,
      evidenceItems: caseStudyParts.evidenceItems.map(mapEvidenceItem),
      timelineEvents: caseStudyParts.timelineEvents.map(mapTimelineEvent),
      lessons: caseStudyParts.lessons.map(mapLesson),
      scoreComponents: caseStudyParts.scoreComponents.map((item) => ({
        componentName: item.component_name,
        rawValue: Number(item.raw_value),
        normalizedScore: Number(item.normalized_score),
        weight: Number(item.weight),
        contribution: Number(item.contribution),
        calculationVersion: item.calculation_version,
        inputSnapshot: item.input_snapshot,
        calculatedAt: item.calculated_at,
      })),
    });
  } catch (error) {
    try {
      const monthlySignal = await getMonthlySignalDetail(id);
      if (monthlySignal) {
        const metric = (monthlySignal.evidence[0] ?? {}) as {
          article_count?: number;
          source_count?: number;
          sample_titles?: string[];
          sample_articles?: Array<{
            id: string;
            title: string;
            source_name: string;
            source_url: string;
            published_at: string | null;
          }>;
          company_actions?: Array<{
            id: string;
            company_symbol: string;
            company_name: string;
            action_type: string;
            title: string;
            summary?: string | null;
            known_at: string;
            source_url: string;
            quality_status: string;
          }>;
          score_components?: Array<{
            componentName: string;
            rawValue: number;
            normalizedScore: number;
            weight: number;
            contribution: number;
            calculationVersion: string;
            inputSnapshot: Record<string, unknown>;
          }>;
          industry_observations?: Array<{
            id: string;
            industry: string;
            metric_name: string;
            metric_value?: number | null;
            metric_text?: string | null;
            unit?: string | null;
            known_at: string;
            source_url: string;
          }>;
          commodity_quotes?: Array<{
            id: string;
            commodity_code: string;
            commodity_name: string;
            quote_date: string;
            price: number;
            currency: string;
            unit: string;
            known_at: string;
            source_url: string;
          }>;
        };
        const companyEvidence = (metric.company_actions ?? []).map((item) => ({
          id: `${monthlySignal.id}-company-${item.id}`,
          signalEventId: monthlySignal.id,
          evidenceDate: item.known_at.slice(0, 10),
          sourceName: item.company_name,
          sourceUrl: item.source_url,
          sourceType: "company_action",
          title: `${item.company_symbol}：${item.title}`,
          summary: item.summary ?? undefined,
          whyItMatters: "這是觀察標的在訊號形成當時已公開的正式公司資訊，可用來驗證新聞主題是否轉化為實際企業行動。",
          knownAtSignalTime: true,
        }));
        const structuredArticles = metric.sample_articles ?? [];
        const newsEvidence = structuredArticles.length > 0
          ? structuredArticles.map((article) => ({
              id: `${monthlySignal.id}-evidence-${article.id}`,
              signalEventId: monthlySignal.id,
              evidenceDate: article.published_at?.slice(0, 10) ?? monthlySignal.asOfDate,
              sourceName: article.source_name,
              sourceUrl: article.source_url,
              sourceType: "news",
              title: article.title,
              summary: `這是 ${monthlySignal.asOfDate} 以前已發布、且符合此候選訊號規則的代表文章。`,
              whyItMatters: "它支持主題正在被市場討論，但仍需與其他獨立來源、公司行動及價格資料交叉驗證。",
              knownAtSignalTime: true,
            }))
          : (metric.sample_titles ?? []).map((title, index) => ({
              id: `${monthlySignal.id}-evidence-${index + 1}`,
              signalEventId: monthlySignal.id,
              evidenceDate: monthlySignal.asOfDate,
              sourceName: "monthly-articles",
              sourceType: "news",
              title,
              summary: "舊版訊號只保存標題，來源連結待補。",
              whyItMatters: "此項只能證明當時的討論內容，不能單獨作為高品質證據。",
              knownAtSignalTime: true,
            }));
        const industryEvidence = (metric.industry_observations ?? []).map((item) => ({
          id: `${monthlySignal.id}-industry-${item.id}`,
          signalEventId: monthlySignal.id,
          evidenceDate: item.known_at.slice(0, 10),
          sourceName: "FRED",
          sourceUrl: item.source_url,
          sourceType: "supply_chain",
          title: `${item.metric_name}：${item.metric_value ?? item.metric_text ?? "-"} ${item.unit ?? ""}`.trim(),
          summary: `產業分類：${item.industry}`,
          whyItMatters: "這是訊號形成時已取得的產業環境資料，用來支持或反駁新聞敘事。",
          knownAtSignalTime: true,
        }));
        const commodityEvidence = (metric.commodity_quotes ?? []).map((item) => ({
          id: `${monthlySignal.id}-commodity-${item.id}`,
          signalEventId: monthlySignal.id,
          evidenceDate: item.known_at.slice(0, 10),
          sourceName: "FRED",
          sourceUrl: item.source_url,
          sourceType: "price",
          title: `${item.commodity_name}：${item.price} ${item.currency}/${item.unit}`,
          summary: `觀測日期 ${item.quote_date}，資料序列 ${item.commodity_code}。`,
          whyItMatters: "這是產業成本或供需背景，不代表個股價格訊號。",
          knownAtSignalTime: true,
        }));
        const evidenceItems = [
          ...companyEvidence,
          ...industryEvidence,
          ...commodityEvidence,
          ...newsEvidence,
        ];

        return NextResponse.json({
          ok: true,
          source: "monthly_current",
          signal: monthlySignal,
          watchlists: monthlySignal.watchlists,
          outcomes: pendingOutcomes(monthlySignal.id),
          stockReturnDetails: emptyStockReturnDetails(),
          evidenceItems,
          timelineEvents: [
            {
              id: `${monthlySignal.id}-timeline-detected`,
              signalEventId: monthlySignal.id,
              eventDate: monthlySignal.signalDate,
              eventType: "signal",
              title: "月度候選形成",
              description: `截至 ${monthlySignal.asOfDate}，由 ${metric.article_count ?? 0} 篇文章與 ${metric.source_count ?? 0} 個來源形成初步訊號。`,
              knownAtSignalTime: true,
              displayOrder: 10,
            },
            {
              id: `${monthlySignal.id}-timeline-validation`,
              signalEventId: monthlySignal.id,
              eventType: "validation",
              title: "等待前瞻驗證",
              description: "訊號日之後的價格資料不得回填到研究假設，只能用於 7／14／30／60 天結果驗證。",
              knownAtSignalTime: false,
              displayOrder: 20,
            },
          ],
          lessons: [
            {
              id: `${monthlySignal.id}-lesson-pending`,
              signalEventId: monthlySignal.id,
              lessonType: "observation",
              title: "目前仍是候選研究",
              description: "已建立研究假設與觀察標的，但尚未完成前瞻報酬驗證。",
              impact: "價格與 benchmark 資料完整後，再判斷訊號是否成立。",
            },
          ],
          scoreComponents: (metric.score_components ?? []).map((item) => ({
            ...item,
            calculatedAt: `${monthlySignal.asOfDate}T23:59:59.000Z`,
          })),
        });
      }

      const signal = await getDerivedSignalById(id);
      if (!signal) return NextResponse.json({ ok: false, error: "Signal not found" }, { status: 404 });

      return NextResponse.json({
        ok: true,
        source: "derived_topics",
        signal,
        watchlists: [],
        outcomes: pendingOutcomes(signal.id),
        stockReturnDetails: emptyStockReturnDetails(),
        evidenceItems: derivedEvidenceItems(signal),
        timelineEvents: derivedTimelineEvents(signal),
        lessons: derivedLessons(signal),
        scoreComponents: [],
      });
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }
}

