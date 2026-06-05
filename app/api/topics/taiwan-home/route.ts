import { NextResponse } from "next/server";
import { discoverCandidateTopics } from "@/lib/topic-candidates";
import { getNewsItems } from "@/lib/rss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TaiwanRegion =
  | "north"
  | "central"
  | "south"
  | "east"
  | "offshore"
  | "strait"
  | "nationwide";

type TaiwanTopic = {
  id: string;
  slug: string;
  title: string;
  category: string;
  region: TaiwanRegion;
  regionLabel: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  summary: string;
  keywords: string[];
  updatedAt: string;
  detailUrl?: string;
  articles: Array<{
    id: string;
    title: string;
    sourceName: string;
    category: string;
    link: string;
    publishedAt: string | null;
    quickSummary: string;
  }>;
};

const REGION_LABELS: Record<TaiwanRegion, string> = {
  north: "北部",
  central: "中部",
  south: "南部",
  east: "東部",
  offshore: "離島",
  strait: "台海周邊",
  nationwide: "全台",
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#8230;|&amp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(value: string) {
  return stripHtml(value)
    .replace(
      /\s*-\s*(Yahoo新聞|Yahoo運動|UDN|聯合新聞網|自由健康網|自由時報|中天新聞網|三立新聞網SETN\.com|風傳媒|中央社即時新聞|中央社|工商時報|中時新聞網|ETtoday新聞雲|鉅亨網)$/i,
      ""
    )
    .replace(/^[^：:]{1,8}[：:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSummaryText(value: string) {
  return stripHtml(value)
    .replace(/\b(Google News|Yahoo新聞|Yahoo奇摩新聞)\b/g, " ")
    .replace(/^（中央社[^）]{0,48}）/, "")
    .replace(/\s*-\s*(Yahoo新聞|UDN|聯合新聞網|中央社|自由時報|中時新聞網|三立新聞網SETN\.com)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateSummaryText(value: string, maxLength = 112) {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) {
    return collapsed.replace(/[。．.]+$/, "").trim();
  }

  const sliced = collapsed.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  const readableSlice =
    lastSpace >= Math.floor(maxLength * 0.72) ? sliced.slice(0, lastSpace) : sliced;

  return readableSlice.replace(/[，,；;：:\s]+$/, "").replace(/[。．.]+$/, "").trim();
}

function makeSlug(input: string, index: number) {
  const slug = input
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);

  return slug || `taiwan-topic-${index + 1}`;
}

function makeQuickSummary(input: {
  title: string;
  description?: string;
  topicTitle?: string;
}) {
  const topic = normalizeText(input.topicTitle ?? "");
  const candidates = [
    input.description ? cleanSummaryText(input.description) : "",
    cleanTitle(input.title),
  ].filter(Boolean);

  const selected =
    candidates.find((candidate) => {
      const normalized = normalizeText(candidate);
      return (
        candidate.length >= 18 &&
        normalized !== topic &&
        !(topic.length >= 8 && normalized.includes(topic))
      );
    }) ?? candidates[0] ?? "";

  return truncateSummaryText(selected);
}

function inferTaiwanRegion(textValue: string): TaiwanRegion {
  const text = normalizeText(textValue);

  if (/金管會|內政部|教育部|交通部|行政院|立法院|全台|全國|國中教育會考|強制險|政策|法規/.test(text)) {
    return "nationwide";
  }

  if (/台海|台灣海峽|海峽|東海|釣魚台|海警|共軍|反艦|軍售|國防|海巡|eez|離島防衛/.test(text)) {
    return "strait";
  }

  if (/澎湖|金門|馬祖|綠島|蘭嶼|小琉球/.test(text)) {
    return "offshore";
  }

  if (/花蓮|台東|宜蘭|東部|太魯閣|蘇花|東海岸/.test(text)) {
    return "east";
  }

  if (/高雄|台南|屏東|嘉義|雲林|南部|恆春|阿里山/.test(text)) {
    return "south";
  }

  if (/台中|臺中|彰化|南投|苗栗|中部/.test(text)) {
    return "central";
  }

  if (/台北|臺北|新北|桃園|基隆|新竹|北部|雙北/.test(text)) {
    return "north";
  }

  return "nationwide";
}

function inferTaiwanCategory(textValue: string, fallback: string) {
  const text = normalizeText(textValue);

  if (/台海|東海|海警|共軍|國防|軍售|反艦|飛彈|海巡|六四|中國|捷克|外交/.test(text)) {
    return "台海與國際";
  }

  if (/豪雨|強降雨|颱風|地震|防災|淹水|積水|災變|氣象|梅雨/.test(text)) {
    return "天氣與防災";
  }

  if (/交通|捷運|公車|列車|機車|道路|機場|中捷|航港局|船艇|駕照/.test(text)) {
    return "交通與生活";
  }

  if (/ai|人工智慧|晶片|半導體|台積電|鴻海|機器人|科技|資料中心/.test(text)) {
    return "科技與產業";
  }

  if (/金管會|保險|強制險|金融|銀行|atm|虛擬資產|關稅|貿易|經濟|產業/.test(text)) {
    return "政策與財經";
  }

  if (/tpbl|中職|棒球|籃球|羽球|法網|運動|賽事|冠軍賽/.test(text)) {
    return "體育";
  }

  return fallback === "國際" ? "台海與國際" : "社會與生活";
}

function isTaiwanRelated(textValue: string) {
  const text = normalizeText(textValue);

  return /台灣|臺灣|台北|臺北|新北|桃園|基隆|新竹|苗栗|台中|臺中|彰化|南投|雲林|嘉義|台南|臺南|高雄|屏東|宜蘭|花蓮|台東|臺東|澎湖|金門|馬祖|台海|東海|台灣海峽|國防|金管會|內政部|交通部|教育部|行政院|立法院|中捷|強制險|豪雨|防災|國中教育會考|tpbl|夢想家|新北國王|台積電|鴻海/.test(
    text
  );
}

function isLowValueTaiwanText(textValue: string) {
  const text = normalizeText(textValue);

  if (/大樂透|威力彩|今彩|開獎|星座|生肖|命理|美食|優惠|折扣|開箱|評測/.test(text)) {
    return true;
  }

  if (/台股|股價|買超|賣超|eps|月營收|合併營收|投信|外資|殖利率|本益比|漲停|跌停/.test(text)) {
    return true;
  }

  if (/克羅埃西亞|法蘭克福|漢莎航空|煤炭業|spacex|anthropic|nba總冠軍賽|尼克|溫班亞瑪|steam machine|valve|fortnite|美國股市|歐洲股市|美股收盤|道瓊|標普500|adr|花旗喊買|喊買|ai 鏈四強|ai鏈四強|晶片股|美股盤後|國際油價|荷莫茲|中東局勢/.test(text)) {
    return true;
  }

  return false;
}

function getFamilyKey(topic: Pick<TaiwanTopic, "title" | "category" | "region">) {
  const text = normalizeText(topic.title);

  if (/台海|東海|海警|反艦|飛彈|共軍|國防|軍售/.test(text)) return "taiwan-security";
  if (/豪雨|強降雨|防災|淹水|氣象|梅雨/.test(text)) return "weather-disaster";
  if (/強制險/.test(text)) return "mandatory-insurance";
  if (/金檢|中國金檢/.test(text)) return "fsc-china-inspection";
  if (/金管會|保險/.test(text)) return "finance-policy";
  if (/tpbl|夢想家|新北國王|湯普金斯|game seven/.test(text)) return "tpbl-finals";
  if (/中捷|捷運|公車|交通/.test(text)) return "transport";
  if (/邱建富|彰化縣長|陳素月/.test(text)) return "changhua-election";
  if (/六四/.test(text)) return "june-fourth";
  if (/捷克|韋德齊/.test(text)) return "czech-visit";
  if (/外交/.test(text)) return "diplomacy";
  if (/台積電|鴻海|英特爾|客製化晶片/.test(text)) return "taiwan-chip-partnership";
  if (/國泰金|小型語言模型|客戶意圖/.test(text)) return "cathay-ai";
  if (/app store|蘋果app store/.test(text)) return "app-store-economy";

  return normalizeText(topic.title)
    .replace(/google news|yahoo新聞|中央社|自由時報|聯合新聞網/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 52);
}

function getImportanceScore(input: {
  title: string;
  description?: string;
  category?: string;
  sourceName?: string;
  sourceWeight?: number;
  articleCount?: number;
  sourceCount?: number;
}) {
  const text = normalizeText(`${input.title} ${input.description ?? ""} ${input.category ?? ""} ${input.sourceName ?? ""}`);
  let score = (input.sourceWeight ?? 1) * 18;

  if (/中央社|官方|政府|內政部|金管會|國防|法院|路透/.test(text)) score += 18;
  if (/台海|國防|飛彈|豪雨|防災|強制險|金管會|捷運|交通|台積電|鴻海/.test(text)) score += 16;
  if (/體育|娛樂|生活/.test(input.category ?? "")) score -= 6;
  if (input.articleCount && input.articleCount >= 2) score += 14;
  if (input.sourceCount && input.sourceCount >= 2) score += 10;

  return Math.max(10, Math.round(score));
}

function makeTaiwanSummary(input: {
  title: string;
  category: string;
  regionLabel: string;
  articleCount: number;
  sourceCount: number;
  articles: Array<{ title: string; quickSummary?: string }>;
}) {
  const points = input.articles
    .map((article) =>
      makeQuickSummary({
        title: article.title,
        description: article.quickSummary,
        topicTitle: input.title,
      })
    )
    .filter(Boolean)
    .filter(
      (point, index, list) =>
        list.findIndex((item) => normalizeText(item) === normalizeText(point)) === index
    )
    .slice(0, 2);

  if (points.length > 0) {
    return `這個焦點目前落在「${input.regionLabel} / ${input.category}」，已整合 ${input.articleCount} 則相關訊號、${input.sourceCount} 個來源；重點是：${points.join("；")}。`;
  }

  return `這個焦點目前落在「${input.regionLabel} / ${input.category}」，後續可追蹤相關來源。`;
}

function mergeTaiwanTopics(topics: TaiwanTopic[]) {
  const merged = new Map<string, TaiwanTopic>();

  topics.forEach((topic) => {
    const key = getFamilyKey(topic);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, topic);
      return;
    }

    const articleMap = new Map(
      existing.articles.map((article) => [article.link || article.id, article])
    );
    topic.articles.forEach((article) => {
      articleMap.set(article.link || article.id, article);
    });

    const articles = [...articleMap.values()].slice(0, 6);
    const sourceCount = new Set(articles.map((article) => article.sourceName)).size;
    const title = existing.title.length <= topic.title.length ? existing.title : topic.title;
    const category = existing.heatScore >= topic.heatScore ? existing.category : topic.category;
    const region = existing.region === "nationwide" ? topic.region : existing.region;
    const regionLabel = REGION_LABELS[region];

    merged.set(key, {
      ...existing,
      title,
      category,
      region,
      regionLabel,
      heatScore: Math.max(existing.heatScore, topic.heatScore) + 10,
      sourceCount: Math.max(existing.sourceCount, topic.sourceCount, sourceCount),
      articleCount: Math.max(existing.articleCount, topic.articleCount, articles.length),
      keywords: [...new Set([...existing.keywords, ...topic.keywords])].slice(0, 8),
      articles,
      summary: makeTaiwanSummary({
        title,
        category,
        regionLabel,
        sourceCount: Math.max(existing.sourceCount, topic.sourceCount, sourceCount),
        articleCount: Math.max(existing.articleCount, topic.articleCount, articles.length),
        articles,
      }),
    });
  });

  return [...merged.values()].sort((a, b) => b.heatScore - a.heatScore);
}

function selectDiverseTopics(topics: TaiwanTopic[], limit: number) {
  const selected: TaiwanTopic[] = [];
  const categoryCounts = new Map<string, number>();
  const regionCounts = new Map<TaiwanRegion, number>();

  topics.forEach((topic) => {
    if (selected.length >= limit) return;
    if (selected.some((item) => item.title === topic.title || item.slug === topic.slug)) return;

    const categoryCount = categoryCounts.get(topic.category) ?? 0;
    const regionCount = regionCounts.get(topic.region) ?? 0;

    if (categoryCount >= 2 || regionCount >= 3) return;

    selected.push(topic);
    categoryCounts.set(topic.category, categoryCount + 1);
    regionCounts.set(topic.region, regionCount + 1);
  });

  return selected;
}

export async function GET() {
  try {
    const newsItems = await getNewsItems({
      category: "全部",
      q: "",
      limit: 260,
      refresh: true,
    });

    const articles = newsItems
      .filter((item) => {
        const text = `${item.title} ${item.description} ${item.category}`;
        return isTaiwanRelated(text) && !isLowValueTaiwanText(text);
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        sourceName: item.sourceName,
        category: item.category,
        sourcePool: item.sourcePool,
        sourceKind: item.sourceKind,
        sourceTier: item.sourceTier,
        sourceWeight: item.sourceWeight,
        credibilityWeight: item.credibilityWeight,
        sourceRole: item.sourceRole,
        link: item.link,
        publishedAt: item.publishedAt,
      }));

    const candidateTopics = discoverCandidateTopics(articles, {
      maxTopics: 14,
      minArticles: 1,
    });

    const candidateTaiwanTopics: TaiwanTopic[] = [];

    const instantTopics: TaiwanTopic[] = articles
      .filter((article) => getImportanceScore(article) >= 30)
      .slice(0, 80)
      .map((article, index) => {
        const title = cleanTitle(article.title);
        const text = `${title} ${article.description ?? ""} ${article.category}`;
        const region = inferTaiwanRegion(text);
        const category = inferTaiwanCategory(text, article.category ?? "新聞");
        const quickSummary = makeQuickSummary({
          title,
          description: article.description,
          topicTitle: title,
        });

        const topicArticles = [
          {
            id: article.id,
            title,
            sourceName: article.sourceName,
            category,
            link: article.link ?? "",
            publishedAt: article.publishedAt,
            quickSummary,
          },
        ];

        return {
          id: `taiwan-news-${article.id}`,
          slug: makeSlug(title, index),
          title,
          category,
          region,
          regionLabel: REGION_LABELS[region],
          heatScore: getImportanceScore(article),
          sourceCount: 1,
          articleCount: 1,
          summary: makeTaiwanSummary({
            title,
            category,
            regionLabel: REGION_LABELS[region],
            articleCount: 1,
            sourceCount: 1,
            articles: topicArticles,
          }),
          keywords: [category, REGION_LABELS[region]].filter(Boolean),
          updatedAt: article.publishedAt ?? new Date().toISOString(),
          detailUrl: article.link,
          articles: topicArticles,
        } satisfies TaiwanTopic;
      });

    const topics = selectDiverseTopics(
      mergeTaiwanTopics([...candidateTaiwanTopics, ...instantTopics]),
      12
    );

    return NextResponse.json(
      {
        ok: true,
        mode: "taiwan-routes-v1",
        generatedAt: new Date().toISOString(),
        articleCount: articles.length,
        candidateCount: candidateTopics.length,
        count: topics.length,
        topics,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Unknown taiwan-home error",
      },
      { status: 500 }
    );
  }
}
