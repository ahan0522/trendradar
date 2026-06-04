import { NextResponse } from "next/server";
import { getHeroImageForCategory } from "@/lib/topic-home";
import { discoverCandidateTopics } from "@/lib/topic-candidates";
import { getNewsItems } from "@/lib/rss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type GlobeTopic = {
  id: string;
  slug: string;
  title: string;
  category: string;
  heroImageUrl: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
  discoveryMode: string;
  summary?: string;
  keywords?: string[];
  detailUrl?: string;
  articles?: Array<{
    id: string;
    title: string;
    sourceName: string;
    category: string;
    link: string;
    publishedAt: string | null;
    quickSummary?: string;
  }>;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

const GENERIC_TERMS = new Set([
  "新聞",
  "最新",
  "今日",
  "焦點",
  "報導",
  "相關",
  "政策",
  "發布",
  "review",
  "news",
  "more",
  "with",
  "from",
]);

function stripHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#8230;|&amp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitle(value: string) {
  return stripHtml(value)
    .replace(/\s*\|\s*[^|]{1,12}\s*\|\s*新聞\s*-\s*風傳媒$/i, "")
    .replace(
      /\s*-\s*(Yahoo新聞|Yahoo運動|UDN|聯合新聞網|自由健康網|自由時報|中天新聞網|三立新聞網SETN\.com|風傳媒|中央社即時新聞|中央社|工商時報|中時新聞網|ETtoday新聞雲|鉅亨網)$/i,
      ""
    )
    .replace(/國價油價/g, "國際油價")
    .replace(/^[^：:]{1,5}[：:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSummaryText(value: string) {
  return stripHtml(value)
    .replace(/\b(Google News|Yahoo新聞|Yahoo奇摩新聞)\b/g, " ")
    .replace(/^（中央社[^）]{0,48}）/, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s*-\s*(Yahoo新聞|UDN|聯合新聞網|中央社|自由時報|中時新聞網|三立新聞網SETN\.com)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function removeTopicEcho(value: string, topicTitle: string) {
  const cleaned = cleanSummaryText(value);
  const normalizedTopic = normalizeText(topicTitle);
  const normalizedValue = normalizeText(cleaned);

  if (
    normalizedTopic.length >= 8 &&
    (normalizedValue === normalizedTopic ||
      normalizedValue.startsWith(`${normalizedTopic} `))
  ) {
    return cleaned.slice(topicTitle.length).replace(/^[\s:：,，、-]+/, "").trim();
  }

  return cleaned;
}

function makeQuickSummary(input: {
  title: string;
  description?: string;
  topicTitle?: string;
}) {
  const normalizedTopic = normalizeText(input.topicTitle ?? "");
  const candidates = [
    input.description ? cleanSummaryText(input.description) : "",
    removeTopicEcho(input.title, input.topicTitle ?? ""),
    cleanTitle(input.title),
  ].filter(Boolean);

  const selected =
    candidates.find((candidate) => {
      const normalized = normalizeText(candidate);
      return (
        candidate.length >= 18 &&
        normalized !== normalizedTopic &&
        !(normalizedTopic.length >= 8 && normalized.includes(normalizedTopic)) &&
        !/^https?:\/\//i.test(candidate)
      );
    }) ?? candidates[0] ?? "";

  if (normalizedTopic.length >= 8 && normalizeText(selected) === normalizedTopic) {
    return "";
  }

  return selected
    .replace(/^[\s:：,，、-]+/, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
}

function makeGlobeSummary(input: {
  title: string;
  category: string;
  sourceCount: number;
  articleCount: number;
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
    .filter((point) => normalizeText(point) !== normalizeText(input.title))
    .filter(
      (point, index, list) =>
        list.findIndex((item) => normalizeText(item) === normalizeText(point)) ===
        index
    )
    .slice(0, 2);

  if (points.length > 0) {
    return `這是目前「${input.category}」類的焦點之一，已整合 ${input.articleCount} 則相關訊號、${input.sourceCount} 個來源；重點包括：${points.join("；")}。`;
  }

  return `這是目前「${input.category}」類的焦點之一，已整合 ${input.articleCount} 則相關訊號、${input.sourceCount} 個來源，後續可從來源文章追蹤細節。`;
}

function getTextTokens(value: string) {
  const text = normalizeText(stripHtml(value));
  const rawTokens = text.match(/[\p{Script=Han}]{2,}|[\p{Letter}\p{Number}]{2,}/gu) ?? [];
  const tokens = new Set<string>();

  rawTokens.forEach((token) => {
    if (GENERIC_TERMS.has(token)) return;

    if (/^[\p{Script=Han}]+$/u.test(token) && token.length > 2) {
      for (let index = 0; index < token.length - 1; index += 1) {
        const bigram = token.slice(index, index + 2);
        if (!GENERIC_TERMS.has(bigram)) tokens.add(bigram);
      }
      return;
    }

    tokens.add(token);
  });

  return [...tokens];
}

function isLowValueTrendText(value: string) {
  const text = normalizeText(value);

  if (/\bgamereactor\b|\.cn\b|it 又到了|it is time for|上新一輪新增內容/.test(text)) {
    return true;
  }

  if (/giveaway|sweepstakes|grab bag|coupon|deal|discount|prime day|sale/.test(text)) {
    return true;
  }

  if (/walkthrough|where to find|locations|all .* locations|guide|unlock|攻略|位置|怎麼取得/.test(text)) {
    return true;
  }

  if (/review|impressions|noticeably smaller|first impressions|評測|開箱/.test(text)) {
    return true;
  }

  if (/digital photo frame|google photos update|saved your/.test(text)) {
    return true;
  }

  if (/social media stars|customize their search result page|creator search profile|influencer search result/.test(text)) {
    return true;
  }

  if (/台股|股價|股市|美國股市|歐洲股市|開盤|買超|賣超|eps|營收展望|合併營收|月營收|\d+\s*月營收|公布\s*\d+\s*月營收|投信|外資|費半|美股早盤|股匯|漲停|跌停|壽險淨值|較去年同期|較上月|殖利率|本益比/.test(text)) {
    return true;
  }

  return false;
}

function hasLowQualityTitle(title: string) {
  const text = normalizeText(title);
  const cleaned = cleanTitle(title);

  if (cleaned.length < 8) return true;
  if (/^[a-z]{1,4}\s+[\p{Script=Han}]/u.test(text)) return true;
  if (/\bgamereactor\b|\.cn\b/.test(text)) return true;
  if (/^\W+$/.test(cleaned)) return true;

  return false;
}

function hasTitleSupport(
  title: string,
  articles: Array<{ title: string; sourceName?: string; category?: string }>
) {
  const terms = getTextTokens(title).filter((term) => term.length >= 2).slice(0, 12);
  if (terms.length <= 2) return true;

  const articleText = normalizeText(
    articles
      .map((article) => `${article.title} ${article.sourceName ?? ""} ${article.category ?? ""}`)
      .join(" ")
  );
  const matchedCount = terms.filter((term) => articleText.includes(term)).length;

  return matchedCount >= Math.min(3, Math.ceil(terms.length * 0.28));
}

function getFamilyKey(topic: Pick<GlobeTopic, "title" | "category">) {
  const text = normalizeText(`${topic.title} ${topic.category}`);

  if (/0050|台股|股價|買超|賣超|eps|營收|etf|投信|外資/.test(text)) {
    return "stock-market";
  }

  if (/伊朗|以色列|美軍|中東|停火|iran|israel/.test(text)) {
    return "middle-east";
  }

  if (/台海|東海|中國海警|兩岸|軍演|國防/.test(text)) {
    return "taiwan-security";
  }

  if (/ai|人工智慧|輝達|nvidia|晶片|伺服器|機器人/.test(text)) {
    return "ai-tech";
  }

  if (/mlb|nba|棒球|籃球|網球|大谷/.test(text)) {
    if (/nba|wembanyama|brunson|馬刺|尼克|總冠軍/.test(text)) {
      return "nba";
    }

    if (/tpbl|國王|籃協/.test(text)) {
      return "taiwan-basketball";
    }

    return "sports";
  }

  return topic.category || "general";
}

function inferGlobeCategory(input: {
  title: string;
  summary?: string;
  keywords?: string[];
  category?: string;
  articles?: Array<{ title: string; category?: string; sourceName?: string }>;
}) {
  const text = normalizeText(
    [
      input.title,
      input.summary ?? "",
      input.category ?? "",
      ...(input.keywords ?? []),
      ...(input.articles ?? []).flatMap((article) => [
        article.title,
        article.category ?? "",
        article.sourceName ?? "",
      ]),
    ].join(" ")
  );

  if (/台海|反艦|飛彈|共軍|國防|軍售|軍演|海巡|eez|主權|制裁|中國侵略|anduril|中國戰車|禁言|64/.test(text)) {
    return "國際";
  }

  if (/伊朗|以色列|黎巴嫩|美軍|中東|停火|俄烏|烏克蘭|菲律賓|韓國|日本|中國制裁/.test(text)) {
    return "國際";
  }

  if (/豪雨|颱風|地震|防災|氣象|大雨|強降雨|淹水/.test(text)) {
    return "新聞";
  }

  if (/醫藥|新藥|臨床|脂肪肝|阿茲海默|疾病|健康|醫療|疫苗|藥物|判讀/.test(text)) {
    return "健康";
  }

  if (/ai|人工智慧|機器人|robot|晶片|半導體|伺服器|資料中心|data center|datacenter|cloud|雲端|科技|平台|自動化|maven|火星探測|無人機|uas/.test(text)) {
    return "AI";
  }

  if (/關稅|課稅|貿易戰|川普課稅|強制險|金管會|保險|經濟|租賃|貿易|產業|金融/.test(text)) {
    return "財經";
  }

  if (/nba|tpbl|mlb|棒球|籃球|網球|大谷|馬刺|尼克|國王|總冠軍/.test(text)) {
    return "體育";
  }

  if (/遊戲|game|nintendo|switch|elden|polygon/.test(text)) {
    return "遊戲";
  }

  if (/手機|gadget|google photos|oura|app|3c|科技產品/.test(text)) {
    return "3C";
  }

  return input.category || "新聞";
}

function selectDiverseTopics(topics: GlobeTopic[], limit: number) {
  const selected: GlobeTopic[] = [];
  const categoryCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();

  for (const topic of topics) {
    if (selected.some((item) => item.slug === topic.slug || item.title === topic.title)) {
      continue;
    }

    const family = getFamilyKey(topic);
    const categoryCount = categoryCounts.get(topic.category) ?? 0;
    const familyCount = familyCounts.get(family) ?? 0;

    const familyLimit = family === "nba" ? 1 : 2;

    if (categoryCount >= 2 || familyCount >= familyLimit) {
      continue;
    }

    selected.push(topic);
    categoryCounts.set(topic.category, categoryCount + 1);
    familyCounts.set(family, familyCount + 1);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function makeSlug(input: string, index: number) {
  const slug = input
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^\p{Script=Han}\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);

  return slug || `instant-topic-${index + 1}`;
}

function getDisplayTitle(title: string, articles: Array<{ title: string }>) {
  const cleanedTitle = cleanTitle(title);
  const titleTokens = getTextTokens(cleanedTitle);

  if (cleanedTitle.length < 10 || titleTokens.length < 3) {
    return cleanTitle(articles[0]?.title ?? cleanedTitle);
  }

  return cleanedTitle;
}

function getInstantImportanceScore(item: Awaited<ReturnType<typeof getNewsItems>>[number]) {
  const text = normalizeText(`${item.title} ${item.description} ${item.category}`);
  let score = (item.sourceWeight ?? 1) * 20;

  if (/路透|中央社|官方|政府|國防|法院|金管會/.test(text)) score += 18;
  if (/台海|飛彈|豪雨|防災|強制險|制裁|停火|關稅|選舉/.test(text)) score += 16;
  if (/資料中心|data center|datacenter|雲端|cloud|機器人|robot|人工智慧|ai infrastructure/.test(text)) score += 10;
  if (/國際|新聞|財經/.test(item.category)) score += 6;
  if (/google is letting|social media stars|customize their search/.test(text)) score -= 18;
  if (/生活|展覽|特展|娛樂/.test(text)) score -= 12;
  if (/遊戲/.test(item.category)) score -= 8;

  return score;
}

function isUsableCandidate(topic: ReturnType<typeof discoverCandidateTopics>[number]) {
  const text = `${topic.title} ${topic.summary} ${topic.keywords.join(" ")}`;

  if (hasLowQualityTitle(topic.title)) return false;
  if (isLowValueTrendText(text)) return false;
  if (!hasTitleSupport(topic.title, topic.articles)) return false;

  return topic.publishable || topic.qualityScore >= 76;
}

function isUsableInstantItem(item: Awaited<ReturnType<typeof getNewsItems>>[number]) {
  const text = `${item.title} ${item.description} ${item.sourceName}`;

  if (hasLowQualityTitle(item.title)) return false;
  if (isLowValueTrendText(text)) return false;
  if (item.category === "遊戲" && !/任天堂|nintendo|switch|索尼|sony|xbox|microsoft|遊戲產業|併購|裁員/.test(text)) {
    return false;
  }
  if (/Google News/.test(item.sourceName) && !/台灣熱門|國際|體育/.test(item.sourceName)) {
    return false;
  }

  if (getInstantImportanceScore(item) < 18) {
    return false;
  }

  return true;
}

export async function GET() {
  try {
    const newsItems = await getNewsItems({
      category: "全部",
      q: "",
      limit: 260,
      refresh: true,
    });

    const articles = newsItems.map((item) => ({
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

    const candidateGlobeTopics: GlobeTopic[] = candidateTopics
      .filter(isUsableCandidate)
      .map((topic) => {
        const displayTitle = getDisplayTitle(topic.title, topic.articles);
        const category = inferGlobeCategory({
          title: displayTitle,
          summary: topic.summary,
          keywords: topic.keywords,
          category: topic.category,
          articles: topic.articles,
        });

        const articleSummaries = topic.articles.map((article) => ({
          ...article,
          title: cleanTitle(article.title),
          quickSummary: makeQuickSummary({
            title: article.title,
            topicTitle: displayTitle,
          }),
        }));

        const summary = makeGlobeSummary({
          title: displayTitle,
          category,
          sourceCount: topic.sourceCount,
          articleCount: topic.articleCount,
          articles: articleSummaries,
        });

        return {
          id: `globe-${topic.id}`,
          slug: makeSlug(displayTitle, Number(topic.id.replace("candidate-", "")) || 0),
          title: displayTitle,
          category,
          heroImageUrl: getHeroImageForCategory(category),
          heatScore: topic.heatScore,
          sourceCount: topic.sourceCount,
          articleCount: topic.articleCount,
          updatedAt: topic.latestPublishedAt,
          discoveryMode: "globe_candidate",
          summary,
          keywords: [category, ...topic.keywords],
          detailUrl: topic.articles[0]?.link,
          articles: articleSummaries,
        } satisfies GlobeTopic;
      })
      .sort((a, b) => b.heatScore - a.heatScore);

    const usedFamilies = new Set(candidateGlobeTopics.map(getFamilyKey));
    const instantTopics: GlobeTopic[] = [];
    const seenArticleTitles = new Set<string>();

    const instantItems = newsItems
      .filter(isUsableInstantItem)
      .sort((a, b) => getInstantImportanceScore(b) - getInstantImportanceScore(a));

    for (const item of instantItems) {
      if (!isUsableInstantItem(item)) continue;

      const title = cleanTitle(item.title);
      const category = inferGlobeCategory({
        title,
        summary: item.description,
        category: item.category,
        articles: [
          {
            title,
            category: item.category,
            sourceName: item.sourceName,
          },
        ],
      });
      const normalizedTitle = normalizeText(title);
      if (seenArticleTitles.has(normalizedTitle)) continue;
      seenArticleTitles.add(normalizedTitle);

      const topic: GlobeTopic = {
        id: `globe-news-${item.id}`,
        slug: makeSlug(title, instantTopics.length),
        title,
        category,
        heroImageUrl: getHeroImageForCategory(category),
        heatScore: Math.max(24, Math.round(getInstantImportanceScore(item))),
        sourceCount: 1,
        articleCount: 1,
        updatedAt: item.publishedAt ?? new Date().toISOString(),
        discoveryMode: "globe_instant_signal",
        summary: makeGlobeSummary({
          title,
          category,
          sourceCount: 1,
          articleCount: 1,
          articles: [
            {
              title,
              quickSummary: item.description,
            },
          ],
        }),
        keywords: [category, item.region].filter(Boolean),
        detailUrl: item.link,
        articles: [
          {
            id: item.id,
            title,
            sourceName: item.sourceName,
            category,
            link: item.link,
            publishedAt: item.publishedAt,
            quickSummary: makeQuickSummary({
              title,
              description: item.description,
              topicTitle: title,
            }),
          },
        ],
      };

      const family = getFamilyKey(topic);
      if (usedFamilies.has(family) && instantTopics.length < 8) {
        continue;
      }

      instantTopics.push(topic);
      usedFamilies.add(family);

      if (instantTopics.length >= 14) {
        break;
      }
    }

    const topics = selectDiverseTopics(
      [...candidateGlobeTopics, ...instantTopics],
      12
    );

    return NextResponse.json(
      {
        ok: true,
        mode: "globe-home-v2",
        generatedAt: new Date().toISOString(),
        articleCount: newsItems.length,
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
          error instanceof Error ? error.message : "Unknown globe-home error",
      },
      { status: 500 }
    );
  }
}
