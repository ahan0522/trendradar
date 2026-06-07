import { NextResponse } from "next/server";
import { getNewsItems } from "@/lib/rss";
import { topicRules } from "@/data/topic-rules";
import { groupArticlesToHomepageTopics } from "@/lib/topic-grouping";
import { getHeroImageForCategory } from "@/lib/topic-home";
import { discoverCandidateTopics } from "@/lib/topic-candidates";
import type { CandidateTopic } from "@/lib/topic-candidates";
import { generateTopicAiSummary } from "@/lib/topic-ai";
import { dedupeArticlesByEvent } from "@/lib/article-dedupe";
import { getEffectiveSourceCount } from "@/lib/source-scoring";
import { createServiceRoleClient } from "../../../../utils/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase-server";
import type { SourceKind, SourcePool, SourceRole, SourceTier } from "@/types/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewsArticle = {
  id: string;
  title: string;
  description?: string;
  sourceName: string;
  category?: string;
  sourcePool?: SourcePool;
  sourceKind?: SourceKind;
  sourceTier?: SourceTier;
  sourceWeight?: number;
  credibilityWeight?: number;
  sourceRole?: SourceRole;
  link?: string;
  publishedAt: string | null;
};

type PersistedArticle = {
  id: string;
  link: string;
};

type SyncedTopic = {
  slug: string;
  title: string;
  category: string;
  discoveryMode: string;
  articleCount: number;
  sourceCount: number;
  heatScore: number;
  linkedArticleCount: number;
};

const SYNC_SOURCE_POOL_LIMIT = 2000;
const SYNC_BALANCED_ARTICLE_LIMIT = 320;
const SYNC_CANDIDATE_DISCOVERY_LIMIT = 640;
const SYNC_CATEGORY_SEED_LIMIT = 8;
const SYNC_OFFICIAL_SEED_LIMIT = 8;
const CANDIDATE_DISCOVERY_CATEGORIES = [
  "國際",
  "台海",
  "新聞",
  "體育",
  "生活",
  "科技",
  "3C",
  "遊戲",
  "AI",
  "文化",
  "娛樂",
];

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textMatchesKeyword(text: string, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);

  if (/^[a-z0-9]{1,3}$/i.test(normalizedKeyword)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}([^a-z0-9]|$)`).test(
      text
    );
  }

  return text.includes(normalizedKeyword);
}

function articleMatchesRule(
  article: NewsArticle,
  keywords: readonly string[],
  excludeKeywords?: readonly string[]
) {
  const haystack = normalizeText(
    `${article.title} ${article.description ?? ""}`
  );

  if (
    excludeKeywords?.some((keyword) =>
      textMatchesKeyword(haystack, keyword)
    )
  ) {
    return false;
  }

  return keywords.some((keyword) => textMatchesKeyword(haystack, keyword));
}

function getLatestPublishedAt(articles: NewsArticle[]) {
  const timestamps = articles
    .map((article) => article.publishedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) {
    return new Date().toISOString();
  }

  return new Date(Math.max(...timestamps)).toISOString();
}

function getArticleTimestamp(article: NewsArticle) {
  const timestamp = article.publishedAt
    ? new Date(article.publishedAt).getTime()
    : 0;

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function getCountSnapshot(map: Map<string, number>) {
  return Object.fromEntries(
    [...map.entries()].sort((a, b) => b[1] - a[1])
  );
}

function uniqueArticlesByLink(articles: NewsArticle[]) {
  const articleByLink = new Map<string, NewsArticle>();

  articles.forEach((article) => {
    if (!article.link || articleByLink.has(article.link)) return;
    articleByLink.set(article.link, article);
  });

  return [...articleByLink.values()];
}

function uniqueCandidateTopicsBySlug(candidates: CandidateTopic[]) {
  const candidateBySlug = new Map<string, CandidateTopic>();

  candidates.forEach((candidate) => {
    const current = candidateBySlug.get(candidate.slug);
    if (!current || candidate.qualityScore > current.qualityScore) {
      candidateBySlug.set(candidate.slug, candidate);
    }
  });

  return [...candidateBySlug.values()];
}

function discoverDiverseCandidateTopics(articles: NewsArticle[]) {
  const globalCandidates = discoverCandidateTopics(articles, {
    maxTopics: 32,
    minArticles: 2,
  });
  const categoryCandidates = CANDIDATE_DISCOVERY_CATEGORIES.flatMap((category) =>
    discoverCandidateTopics(
      articles.filter((article) => article.category === category),
      {
        maxTopics: 6,
        minArticles: 2,
      }
    )
  );

  return uniqueCandidateTopicsBySlug([
    ...globalCandidates,
    ...categoryCandidates,
  ])
    .filter((topic) => topic.publishable)
    .sort((a, b) => {
      if (a.qualityScore !== b.qualityScore) {
        return b.qualityScore - a.qualityScore;
      }

      return b.heatScore - a.heatScore;
    });
}

function selectBalancedArticlesForSync(
  articles: NewsArticle[],
  limit = SYNC_BALANCED_ARTICLE_LIMIT
) {
  const selected: NewsArticle[] = [];
  const selectedLinks = new Set<string>();
  const categoryCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const poolCounts = new Map<string, number>();
  const sortedArticles = [...articles].sort(
    (a, b) => getArticleTimestamp(b) - getArticleTimestamp(a)
  );
  const categoryCap = Math.max(24, Math.ceil(limit * 0.22));
  const sourceCap = Math.max(12, Math.ceil(limit * 0.14));
  const officialSourceCap = Math.max(8, Math.ceil(limit * 0.12));

  function canSelect(article: NewsArticle, relaxed = false) {
    if (!article.link || selectedLinks.has(article.link)) {
      return false;
    }

    const category = article.category || "未分類";
    const sourceName = article.sourceName || "未知來源";
    const sourcePool = article.sourcePool || "news_media";

    if (!relaxed && (categoryCounts.get(category) ?? 0) >= categoryCap) {
      return false;
    }

    if ((sourceCounts.get(sourceName) ?? 0) >= sourceCap) {
      return false;
    }

    if (
      sourcePool === "official_source" &&
      (poolCounts.get(sourcePool) ?? 0) >= officialSourceCap
    ) {
      return false;
    }

    return true;
  }

  function addArticle(article: NewsArticle) {
    const category = article.category || "未分類";
    const sourceName = article.sourceName || "未知來源";
    const sourcePool = article.sourcePool || "news_media";

    selected.push(article);
    selectedLinks.add(article.link ?? article.id);
    incrementCount(categoryCounts, category);
    incrementCount(sourceCounts, sourceName);
    incrementCount(poolCounts, sourcePool);
  }

  const categoryGroups = new Map<string, NewsArticle[]>();

  sortedArticles.forEach((article) => {
    const category = article.category || "未分類";
    const items = categoryGroups.get(category) ?? [];
    items.push(article);
    categoryGroups.set(category, items);
  });

  for (const group of categoryGroups.values()) {
    let categorySeedCount = 0;

    for (const article of group) {
      if (categorySeedCount >= SYNC_CATEGORY_SEED_LIMIT) break;
      if (selected.length >= limit) break;

      if (canSelect(article, true)) {
        addArticle(article);
        categorySeedCount += 1;
      }
    }
  }

  let officialSeedCount = 0;

  for (const article of sortedArticles) {
    if (officialSeedCount >= SYNC_OFFICIAL_SEED_LIMIT) break;
    if (selected.length >= limit) break;
    if (article.sourcePool !== "official_source") continue;

    if (canSelect(article, true)) {
      addArticle(article);
      officialSeedCount += 1;
    }
  }

  for (const article of sortedArticles) {
    if (selected.length >= limit) break;
    if (canSelect(article)) addArticle(article);
  }

  for (const article of sortedArticles) {
    if (selected.length >= limit) break;
    if (canSelect(article, true)) addArticle(article);
  }

  return {
    articles: selected,
    categorySampleCounts: getCountSnapshot(categoryCounts),
    sourcePoolSampleCounts: getCountSnapshot(poolCounts),
    sourceSampleCounts: Object.fromEntries(
      Object.entries(getCountSnapshot(sourceCounts)).slice(0, 12)
    ),
  };
}

function isAuthorized(request: Request) {
  const token = process.env.CRON_SECRET;

  if (!token) {
    return process.env.NODE_ENV !== "production";
  }

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  return bearer === token;
}

function getTriggerSource(request: Request) {
  return request.headers.get("user-agent")?.toLowerCase().includes("vercel")
    ? "vercel-cron"
    : "manual";
}

function getCandidateFamily(candidate: {
  title: string;
  slug: string;
  category: string;
  keywords?: string[];
}) {
  const text = `${candidate.title} ${candidate.slug} ${candidate.category} ${
    candidate.keywords?.join(" ") ?? ""
  }`.toLowerCase();

  if (/伊朗|美軍|中東|以色列|黎巴嫩|真主黨|停火/.test(text)) return "middle-east";
  if (/0050|etf|成分股|換股|換血/.test(text)) return "etf-rebalance";
  if (/關稅|301調查|貿易談判|重建關稅壁壘|對台徵/.test(text)) return "trade-policy";
  if (/股價|投信|外資|買超|營收|eps|概念股|台股|美股/.test(text)) return "stock-market";
  if (/輝達|黃仁勳|nvidia|台積電|晶片|半導體|gpu|ai\s*晶片/.test(text)) return "ai-chips";
  if (/openai|anthropic|模型|ai模型|人工智慧|ai熱潮|ai發展/.test(text)) return "ai-policy-market";
  if (/台海|美中台海|東海|中國海警|兩岸|國防|軍演|美防長|印太|對台/.test(text)) return "taiwan-security";
  if (/t-34|教練機|飛官|軍機|墜毀|殉職|相驗/.test(text)) return "taiwan-incident";
  if (/普丁|澤倫斯基|俄烏|烏克蘭|俄羅斯|停火談判|和平談判/.test(text)) return "russia-ukraine";
  if (/火星|隕石坑|宜居|古環境|太空|天文|行星|nasa|space|mars/.test(text)) return "space-science";
  if (/伊波拉|cdc|who|疫情|確診|疫苗|冠狀病毒|廣效疫苗|公衛/.test(text)) return "public-health";
  if (/選舉|南韓|韓國|尹錫悅|李在明|韓成淑|女總理|內閣|總理提名|無票可投/.test(text)) {
    return "election-politics";
  }
  if (/mlb|大谷翔平|山本由伸|道奇|塞揚|misiorowski|火球/.test(text)) return "mlb";
  if (/中職|棒球|台鋼|味全|王維中|先發|延賽|澄清湖|龍鷹戰/.test(text)) return "baseball";
  if (/nba|mlb|中職|棒球|籃球|法網|網球/.test(text)) return "sports";
  if (/電競|playstation|ps5|state of play|遊戲|gameplay/.test(text)) return "games";
  if (/豪雨|強降雨|暴雨|雷雨|颱風|熱帶低壓|地震|淹水|防災|氣象|航班|機場|地面作業|地方/.test(text)) {
    return "life-safety";
  }
  if (/故宮|文化|影展|金曲|金馬|展覽|博物館|文學|藝術|劇場/.test(text)) return "culture";

  return candidate.category || "general";
}

function getCandidateCategory(candidate: {
  title: string;
  slug: string;
  category: string;
  keywords?: string[];
}) {
  const family = getCandidateFamily(candidate);

  if (family === "ai-chips") return "科技";
  if (family === "ai-policy-market") return "AI";
  if (family === "taiwan-security") return "台海";
  if (family === "taiwan-incident") return "新聞";
  if (family === "russia-ukraine") return "國際";
  if (family === "space-science") return "科技";
  if (family === "public-health") return "生活";
  if (family === "election-politics") return "政治";
  if (family === "mlb") return "體育";
  if (family === "middle-east") return "國際";
  if (family === "trade-policy") return "國際";
  if (family === "baseball") return "體育";
  if (family === "sports") return "體育";
  if (family === "games") return "遊戲";
  if (family === "etf-rebalance") return "財經";
  if (family === "life-safety") return "生活";
  if (family === "culture") return "文化";

  return candidate.category || "新聞";
}

function hasEnoughCandidateDepth(input: {
  category: string;
  title: string;
  candidateArticleCount: number;
  representativeArticleCount: number;
  effectiveSourceCount: number;
  qualityScore: number;
}) {
  const text = `${input.category} ${input.title}`.toLowerCase();

  if (/股價|投信|外資|買超|賣超|營收|eps|概念股|台股|美股/.test(text)) {
    return false;
  }

  if (/財經/.test(input.category) && /ai\s*伺服器零件與供應鏈/i.test(text)) {
    return false;
  }

  if (input.representativeArticleCount >= 2 && input.effectiveSourceCount >= 2) {
    return true;
  }

  const hasStrongBackedEvent =
    input.candidateArticleCount >= 2 &&
    input.effectiveSourceCount >= 3 &&
    input.qualityScore >= 90 &&
    !/財經/.test(input.category);

  if (input.representativeArticleCount >= 1 && hasStrongBackedEvent) {
    return true;
  }

  return false;
}

async function handleSyncGrouped(request: Request) {
  const startedAt = Date.now();
  const runId =
    crypto.randomUUID?.() ?? `sync-${startedAt}-${Math.random().toString(36).slice(2)}`;

  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized sync-grouped request",
      },
      { status: 401 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 }
    );
  }

  try {
    const supabase = createServiceRoleClient();

    console.info("[sync-grouped] started", {
      runId,
      triggeredBy: getTriggerSource(request),
    });

    const newsItems = await getNewsItems({
      category: "全部",
      q: "",
      limit: SYNC_SOURCE_POOL_LIMIT,
    });

    const sourceArticles: NewsArticle[] = newsItems
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description ?? "",
        sourceName: item.sourceName,
        category: item.category ?? "",
        sourcePool: item.sourcePool,
        sourceKind: item.sourceKind,
        sourceTier: item.sourceTier,
        sourceWeight: item.sourceWeight,
        credibilityWeight: item.credibilityWeight,
        sourceRole: item.sourceRole,
        link: item.link ?? "",
        publishedAt: item.publishedAt,
      }))
      .filter((item) => item.link);
    const {
      articles,
      categorySampleCounts,
      sourcePoolSampleCounts,
      sourceSampleCounts,
    } = selectBalancedArticlesForSync(sourceArticles);
    const {
      articles: candidateDiscoveryArticles,
      categorySampleCounts: candidateDiscoveryCategoryCounts,
    } = selectBalancedArticlesForSync(sourceArticles, SYNC_CANDIDATE_DISCOVERY_LIMIT);
    const candidateTopics = discoverDiverseCandidateTopics(candidateDiscoveryArticles);
    const candidateTopicArticleLinks = new Set(
      candidateTopics.flatMap((topic) =>
        topic.articles.map((article) => article.link).filter(Boolean)
      )
    );
    const articlesToPersist = uniqueArticlesByLink([
      ...articles,
      ...candidateDiscoveryArticles.filter((article) =>
        article.link ? candidateTopicArticleLinks.has(article.link) : false
      ),
    ]);

    // 1. 先寫入 articles，直接拿回 DB 真正的 id
    const articleRows = articlesToPersist.map((article) => ({
      title: article.title,
      link: article.link ?? "",
      source_id: null,
      source_name: article.sourceName,
      category: article.category ?? "",
      region: "global",
      published_at: article.publishedAt,
      description: article.description ?? "",
    }));

    const { data: persistedArticles, error: articlesError } = await supabase
      .from("articles")
      .upsert(articleRows, { onConflict: "link" })
      .select("id, link");

    if (articlesError) {
      return NextResponse.json(
        {
          ok: false,
          error: `寫入 articles 失敗: ${articlesError.message}`,
        },
        { status: 500 }
      );
    }

    const articleIdByLink = new Map<string, string>();
    (persistedArticles as PersistedArticle[] | null)?.forEach((article) => {
      articleIdByLink.set(article.link, article.id);
    });

    // 2. 再做主題分群
    const groupedTopics = groupArticlesToHomepageTopics(articles);

    const syncedTopics: SyncedTopic[] = [];
    let linkedArticleCount = 0;
    let skippedTopicsWithoutRule = 0;
    let skippedTopicsWithoutArticles = 0;
    let skippedCandidateTopicsCoveredByRules = 0;
    const ruleCoveredArticleLinks = new Set<string>();

    for (const grouped of groupedTopics) {
      const rule = topicRules.find((item) => item.key === grouped.slug);
      if (!rule) {
        skippedTopicsWithoutRule += 1;
        continue;
      }

      const matchedArticles = articles.filter((article) =>
        articleMatchesRule(article, rule.keywords, rule.excludeKeywords)
      );

      if (matchedArticles.length === 0) {
        skippedTopicsWithoutArticles += 1;
        continue;
      }

      matchedArticles.forEach((article) => {
        if (article.link) {
          ruleCoveredArticleLinks.add(article.link);
        }
      });

      const representativeArticles = dedupeArticlesByEvent(matchedArticles);
      const effectiveSourceCount = getEffectiveSourceCount(matchedArticles);

      const aiResult = await generateTopicAiSummary({
        topicTitle: rule.title,
        category: rule.category,
        keywords: rule.keywords,
        articles: representativeArticles.map((article) => ({
          title: article.title,
          description: article.description ?? "",
          sourceName: article.sourceName,
        })),
      });

      const topicRow = {
        slug: grouped.slug,
        title: grouped.title,
        long_title: aiResult.longTitle,
        category: grouped.category,
        summary: aiResult.summary,
        bullets: aiResult.bullets,
        subtopics: aiResult.subtopics,
        tags: aiResult.tags,
        hero_image_url: grouped.heroImageUrl,
        heat_score: grouped.heatScore,
        source_count: effectiveSourceCount,
        article_count: representativeArticles.length,
        last_article_published_at: getLatestPublishedAt(matchedArticles),
        last_synced_at: new Date().toISOString(),
        rule_key: rule.key,
        keywords: rule.keywords,
        discovery_mode: "rule_based",
        status: "active",
        region: "global",
      };

      const { data: upsertedTopics, error: topicError } = await supabase
        .from("topics")
        .upsert(topicRow, { onConflict: "slug" })
        .select("id, slug");

      if (topicError) {
        return NextResponse.json(
          {
            ok: false,
            error: `寫入 topics 失敗: ${topicError.message}`,
          },
          { status: 500 }
        );
      }

      const topicId = upsertedTopics?.[0]?.id;
      if (!topicId) {
        return NextResponse.json(
          {
            ok: false,
            error: `找不到 topics.id，slug=${grouped.slug}`,
          },
          { status: 500 }
        );
      }

      const topicArticleRows = representativeArticles
        .map((article) => {
          const persistedArticleId = article.link
            ? articleIdByLink.get(article.link)
            : undefined;

          if (!persistedArticleId) return null;

          return {
            topic_id: topicId,
            article_id: persistedArticleId,
          };
        })
        .filter(Boolean);

      linkedArticleCount += topicArticleRows.length;

      const { error: deleteTopicArticlesError } = await supabase
        .from("topic_articles")
        .delete()
        .eq("topic_id", topicId);

      if (deleteTopicArticlesError) {
        return NextResponse.json(
          {
            ok: false,
            error: `清理舊 topic_articles 失敗: ${deleteTopicArticlesError.message}`,
          },
          { status: 500 }
        );
      }

      const { error: topicArticlesError } = await supabase
        .from("topic_articles")
        .upsert(topicArticleRows as { topic_id: string; article_id: string }[], {
          onConflict: "topic_id,article_id",
        });

      if (topicArticlesError) {
        return NextResponse.json(
          {
            ok: false,
            error: `寫入 topic_articles 失敗: ${topicArticlesError.message}`,
          },
          { status: 500 }
        );
      }

      syncedTopics.push({
        slug: grouped.slug,
        title: grouped.title,
        category: grouped.category,
        discoveryMode: "rule_based",
        articleCount: representativeArticles.length,
        sourceCount: effectiveSourceCount,
        heatScore: grouped.heatScore,
        linkedArticleCount: topicArticleRows.length,
      });
    }

    const activeRuleKeys = topicRules.map((rule) => rule.key).join(",");
    const archiveRetiredRulesQuery = supabase
      .from("topics")
      .update({
        status: "inactive",
        last_synced_at: new Date().toISOString(),
      })
      .eq("discovery_mode", "rule_based");

    const { error: archiveRetiredRulesError } = activeRuleKeys
      ? await archiveRetiredRulesQuery.not("rule_key", "in", `(${activeRuleKeys})`)
      : await archiveRetiredRulesQuery;

    if (archiveRetiredRulesError) {
      return NextResponse.json(
        {
          ok: false,
          error: `封存退役規則 topics 失敗: ${archiveRetiredRulesError.message}`,
        },
        { status: 500 }
      );
    }

    const { error: archiveCandidateTopicsError } = await supabase
      .from("topics")
      .update({
        status: "inactive",
        last_synced_at: new Date().toISOString(),
      })
      .eq("discovery_mode", "candidate_cluster");

    if (archiveCandidateTopicsError) {
      return NextResponse.json(
        {
          ok: false,
          error: `封存舊候選 topics 失敗: ${archiveCandidateTopicsError.message}`,
        },
        { status: 500 }
      );
    }

    const syncedRuleTitles = new Set(
      syncedTopics.map((topic) => normalizeText(topic.title))
    );
    const candidateCategoryCounts = new Map<string, number>();
    const candidateFamilyCounts = new Map<string, number>();
    let skippedCandidateTopicsForDiversity = 0;
    let skippedCandidateTopicsTooThin = 0;
    const skippedCandidateTopicSamples: Array<{
      title: string;
      reason: string;
      category: string;
      family: string;
      candidateArticleCount: number;
      representativeArticleCount?: number;
      sourceCount: number;
      qualityScore: number;
    }> = [];

    for (const candidate of candidateTopics) {
      if (syncedRuleTitles.has(normalizeText(candidate.title))) {
        continue;
      }

      const candidateFamily = getCandidateFamily(candidate);
      const candidateCategory = getCandidateCategory(candidate);
      const candidateCategoryCount =
        candidateCategoryCounts.get(candidateCategory) ?? 0;
      const candidateFamilyCount =
        candidateFamilyCounts.get(candidateFamily) ?? 0;

      const candidateCategoryLimit = candidateCategory === "財經" ? 1 : 2;

      if (
        candidateCategoryCount >= candidateCategoryLimit ||
        candidateFamilyCount >= 1
      ) {
        skippedCandidateTopicsForDiversity += 1;
        if (skippedCandidateTopicSamples.length < 8) {
          skippedCandidateTopicSamples.push({
            title: candidate.title,
            reason: "diversity_limit",
            category: candidateCategory,
            family: candidateFamily,
            candidateArticleCount: candidate.articleCount,
            sourceCount: candidate.sourceCount,
            qualityScore: candidate.qualityScore,
          });
        }
        continue;
      }

      const matchedArticles = candidate.articles
        .map((candidateArticle) =>
          candidateDiscoveryArticles.find(
            (article) => article.link === candidateArticle.link
          )
        )
        .filter((article): article is NewsArticle => Boolean(article));

      if (matchedArticles.length === 0) {
        skippedTopicsWithoutArticles += 1;
        continue;
      }

      const isAlreadyCoveredByRules = matchedArticles.every(
        (article) => article.link && ruleCoveredArticleLinks.has(article.link)
      );

      if (
        isAlreadyCoveredByRules &&
        normalizeText(candidate.category) === "ai" &&
        candidate.qualityScore < 88
      ) {
        skippedCandidateTopicsCoveredByRules += 1;
        continue;
      }

      const representativeArticles = dedupeArticlesByEvent(matchedArticles);
      const effectiveSourceCount = Math.max(
        getEffectiveSourceCount(matchedArticles),
        candidate.sourceCount
      );

      if (
        !hasEnoughCandidateDepth({
          category: candidateCategory,
          title: candidate.title,
          candidateArticleCount: candidate.articleCount,
          representativeArticleCount: representativeArticles.length,
          effectiveSourceCount,
          qualityScore: candidate.qualityScore,
        })
      ) {
        skippedCandidateTopicsTooThin += 1;
        if (skippedCandidateTopicSamples.length < 8) {
          skippedCandidateTopicSamples.push({
            title: candidate.title,
            reason: "too_thin_after_event_dedupe",
            category: candidateCategory,
            family: candidateFamily,
            candidateArticleCount: candidate.articleCount,
            representativeArticleCount: representativeArticles.length,
            sourceCount: effectiveSourceCount,
            qualityScore: candidate.qualityScore,
          });
        }
        continue;
      }

      const aiResult = await generateTopicAiSummary({
        topicTitle: candidate.title,
        category: candidateCategory,
        keywords: candidate.keywords,
        articles: representativeArticles.map((article) => ({
          title: article.title,
          description: article.description ?? "",
          sourceName: article.sourceName,
        })),
      });

      const topicRow = {
        slug: candidate.slug,
        title: candidate.title,
        long_title: aiResult.longTitle,
        category: candidateCategory,
        summary: aiResult.summary || candidate.summary,
        bullets: aiResult.bullets,
        subtopics: aiResult.subtopics,
        tags: aiResult.tags,
        hero_image_url: getHeroImageForCategory(candidateCategory),
        heat_score: candidate.heatScore,
        source_count: effectiveSourceCount,
        article_count: representativeArticles.length,
        last_article_published_at: candidate.latestPublishedAt,
        last_synced_at: new Date().toISOString(),
        rule_key: null,
        keywords: candidate.keywords,
        discovery_mode: "candidate_cluster",
        status: "active",
        region: "global",
      };

      const { data: upsertedTopics, error: topicError } = await supabase
        .from("topics")
        .upsert(topicRow, { onConflict: "slug" })
        .select("id, slug");

      if (topicError) {
        return NextResponse.json(
          {
            ok: false,
            error: `寫入候選 topics 失敗: ${topicError.message}`,
          },
          { status: 500 }
        );
      }

      const topicId = upsertedTopics?.[0]?.id;
      if (!topicId) {
        return NextResponse.json(
          {
            ok: false,
            error: `找不到候選 topics.id，slug=${candidate.slug}`,
          },
          { status: 500 }
        );
      }

      const topicArticleRows = representativeArticles
        .map((article) => {
          const persistedArticleId = article.link
            ? articleIdByLink.get(article.link)
            : undefined;

          if (!persistedArticleId) return null;

          return {
            topic_id: topicId,
            article_id: persistedArticleId,
          };
        })
        .filter(Boolean);

      linkedArticleCount += topicArticleRows.length;

      const { error: deleteTopicArticlesError } = await supabase
        .from("topic_articles")
        .delete()
        .eq("topic_id", topicId);

      if (deleteTopicArticlesError) {
        return NextResponse.json(
          {
            ok: false,
            error: `清理候選 topic_articles 失敗: ${deleteTopicArticlesError.message}`,
          },
          { status: 500 }
        );
      }

      const { error: topicArticlesError } = await supabase
        .from("topic_articles")
        .upsert(topicArticleRows as { topic_id: string; article_id: string }[], {
          onConflict: "topic_id,article_id",
        });

      if (topicArticlesError) {
        return NextResponse.json(
          {
            ok: false,
            error: `寫入候選 topic_articles 失敗: ${topicArticlesError.message}`,
          },
          { status: 500 }
        );
      }

      syncedTopics.push({
        slug: candidate.slug,
        title: candidate.title,
        category: candidateCategory,
        discoveryMode: "candidate_cluster",
        articleCount: representativeArticles.length,
        sourceCount: effectiveSourceCount,
        heatScore: candidate.heatScore,
        linkedArticleCount: topicArticleRows.length,
      });
      candidateCategoryCounts.set(candidateCategory, candidateCategoryCount + 1);
      candidateFamilyCounts.set(candidateFamily, candidateFamilyCount + 1);
    }

    const summary = {
      ok: true,
      runId,
      mode: "topics-sync-grouped",
      triggeredBy: getTriggerSource(request),
      syncedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      sourcePoolArticleCount: sourceArticles.length,
      articleCount: articles.length,
      candidateDiscoveryArticleCount: candidateDiscoveryArticles.length,
      persistedArticleInputCount: articlesToPersist.length,
      categorySampleCounts,
      candidateDiscoveryCategoryCounts,
      sourcePoolSampleCounts,
      sourceSampleCounts,
      persistedArticleCount: persistedArticles?.length ?? 0,
      groupedTopicCount: groupedTopics.length,
      candidateTopicCount: candidateTopics.length,
      topicCount: syncedTopics.length,
      linkedArticleCount,
      skippedTopicsWithoutRule,
      skippedTopicsWithoutArticles,
      skippedCandidateTopicsCoveredByRules,
      skippedCandidateTopicsForDiversity,
      skippedCandidateTopicsTooThin,
      skippedCandidateTopicSamples,
      topics: syncedTopics,
    };

    console.info("[sync-grouped] completed", summary);

    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";

    console.error("[sync-grouped] failed", {
      runId,
      durationMs: Date.now() - startedAt,
      error: message,
    });

    return NextResponse.json(
      {
        ok: false,
        runId,
        error: `sync-grouped 執行失敗: ${message}`,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return handleSyncGrouped(request);
}

export async function POST(request: Request) {
  return handleSyncGrouped(request);
}
