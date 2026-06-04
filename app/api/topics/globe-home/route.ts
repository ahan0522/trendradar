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
    .replace(/\s*-\s*(Yahoo新聞|Yahoo運動|UDN|自由健康網|中天新聞網|三立新聞網SETN\.com)$/i, "")
    .replace(/^[^：:]{1,5}[：:]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
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

  if (/台股|股價|買超|賣超|eps|合併營收|投信|外資|費半|美股早盤|股匯|漲停|跌停|壽險淨值/.test(text)) {
    return true;
  }

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
  if (/國際|新聞|財經/.test(item.category)) score += 6;
  if (/生活|展覽|特展|娛樂/.test(text)) score -= 12;
  if (/遊戲/.test(item.category)) score -= 8;

  return score;
}

function isUsableCandidate(topic: ReturnType<typeof discoverCandidateTopics>[number]) {
  const text = `${topic.title} ${topic.summary} ${topic.keywords.join(" ")}`;

  if (isLowValueTrendText(text)) return false;
  if (!hasTitleSupport(topic.title, topic.articles)) return false;

  return topic.publishable || topic.qualityScore >= 76;
}

function isUsableInstantItem(item: Awaited<ReturnType<typeof getNewsItems>>[number]) {
  const text = `${item.title} ${item.description} ${item.sourceName}`;

  if (isLowValueTrendText(text)) return false;
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

        return {
          id: `globe-${topic.id}`,
          slug: makeSlug(displayTitle, Number(topic.id.replace("candidate-", "")) || 0),
          title: displayTitle,
          category: topic.category,
          heroImageUrl: getHeroImageForCategory(topic.category),
          heatScore: topic.heatScore,
          sourceCount: topic.sourceCount,
          articleCount: topic.articleCount,
          updatedAt: topic.latestPublishedAt,
          discoveryMode: "globe_candidate",
          summary: topic.summary.replace(topic.title, displayTitle),
          keywords: topic.keywords,
          detailUrl: topic.articles[0]?.link,
          articles: topic.articles.map((article) => ({
            ...article,
            title: cleanTitle(article.title),
            quickSummary: cleanTitle(article.title),
          })),
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
      const normalizedTitle = normalizeText(title);
      if (seenArticleTitles.has(normalizedTitle)) continue;
      seenArticleTitles.add(normalizedTitle);

      const topic: GlobeTopic = {
        id: `globe-news-${item.id}`,
        slug: makeSlug(title, instantTopics.length),
        title,
        category: item.category,
        heroImageUrl: getHeroImageForCategory(item.category),
        heatScore: Math.max(24, Math.round(getInstantImportanceScore(item))),
        sourceCount: 1,
        articleCount: 1,
        updatedAt: item.publishedAt ?? new Date().toISOString(),
        discoveryMode: "globe_instant_signal",
        summary: stripHtml(item.description || title),
        keywords: [item.category, item.region].filter(Boolean),
        detailUrl: item.link,
        articles: [
          {
            id: item.id,
            title,
            sourceName: item.sourceName,
            category: item.category,
            link: item.link,
            publishedAt: item.publishedAt,
            quickSummary: stripHtml(item.description || title),
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
