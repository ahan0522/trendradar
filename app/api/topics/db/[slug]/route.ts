import { NextRequest, NextResponse } from "next/server";
import { cleanRssText } from "@/lib/rss";
import { getCanonicalSourceName, isPlatformSourceName } from "@/lib/source-scoring";
import { generateArticleQuickSummary } from "@/lib/topic-ai";
import { createServiceRoleClient } from "../../../../../utils/supabase/server";

type DbTopicRow = {
  id: string;
  slug: string;
  title: string;
  long_title: string | null;
  category: string | null;
  hero_image_url: string | null;
  heat_score: number | null;
  source_count: number | null;
  article_count: number | null;
  last_article_published_at: string | null;
  last_synced_at: string | null;
  summary: string | null;
  bullets: string[] | null;
  subtopics: string[] | null;
  tags: string[] | null;
  rule_key: string | null;
  keywords: string[] | null;
  discovery_mode: string | null;
  status: string | null;
};

type DbTopicArticleRow = {
  article_id: string;
};

type DbArticleRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  region: string | null;
  source_id: string | null;
  source_name: string | null;
  link: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ResponseArticle = {
  id: string;
  title: string;
  description: string;
  quickSummary: string;
  category: string;
  region: string;
  sourceId: string;
  sourceName: string;
  link: string;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

function normalizeComparableText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[a-z0-9-]+\.(com|tw|org|net|io|ai)\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getArticleSimilarityKey(article: ResponseArticle) {
  const summary = normalizeComparableText(article.quickSummary);

  if (summary.length >= 20) {
    return `summary:${summary.slice(0, 80)}`;
  }

  return `title:${normalizeComparableText(article.title).slice(0, 80)}`;
}

function mergeSourceNames(sourceNames: string[]) {
  const canonicalSources = [...new Set(
    sourceNames
      .filter(Boolean)
      .map((sourceName) => getCanonicalSourceName({ sourceName }))
      .filter((sourceName) => sourceName && sourceName !== "unknown")
  )];
  const originalSources = canonicalSources.filter(
    (sourceName) => !isPlatformSourceName(sourceName)
  );

  return (originalSources.length ? originalSources : canonicalSources).join("、") || "Google News";
}

function tokenizeComparableText(value: string) {
  return normalizeComparableText(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function getTextSimilarity(a: string, b: string) {
  const aTokens = new Set(tokenizeComparableText(a));
  const bTokens = new Set(tokenizeComparableText(b));

  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  const overlap = [...aTokens].filter((token) => bTokens.has(token)).length;
  return overlap / Math.max(1, Math.min(aTokens.size, bTokens.size));
}

function areLikelySameStory(a: ResponseArticle, b: ResponseArticle) {
  const sameCanonicalSource =
    getCanonicalSourceName(a) ===
    getCanonicalSourceName(b);
  const summarySimilarity = getTextSimilarity(a.quickSummary, b.quickSummary);
  const titleSimilarity = getTextSimilarity(a.title, b.title);

  if (summarySimilarity >= 0.78 || titleSimilarity >= 0.78) {
    return true;
  }

  return sameCanonicalSource && (summarySimilarity >= 0.58 || titleSimilarity >= 0.58);
}

function dedupeSimilarArticles(articles: ResponseArticle[]) {
  const articleGroups: ResponseArticle[][] = [];

  articles.forEach((article) => {
    const key = getArticleSimilarityKey(article);
    const matchedGroup = articleGroups.find((group) =>
      group.some(
        (existingArticle) =>
          getArticleSimilarityKey(existingArticle) === key ||
          areLikelySameStory(existingArticle, article)
      )
    );

    if (matchedGroup) {
      matchedGroup.push(article);
      return;
    }

    articleGroups.push([article]);
  });

  return articleGroups
    .map((group) => {
      const sortedGroup = [...group].sort((a, b) => {
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

        return bTime - aTime;
      });
      const primary = sortedGroup[0];

      return {
        ...primary,
        sourceName: mergeSourceNames(sortedGroup.map((article) => article.sourceName)),
      };
    })
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

      return bTime - aTime;
    })
    .slice(0, 8);
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getCanonicalSourceNames(articles: ResponseArticle[]) {
  const canonicalSources = uniqueStrings(
    articles
      .flatMap((article) =>
        article.sourceName
          .split(/[、,，/]/)
          .map((sourceName) =>
            getCanonicalSourceName({
              ...article,
              sourceName: sourceName.trim(),
            })
          )
      )
      .filter((sourceName) => sourceName && sourceName !== "unknown")
  );
  const originalSources = canonicalSources.filter(
    (sourceName) => !isPlatformSourceName(sourceName)
  );

  return originalSources.length ? originalSources : canonicalSources;
}

function getTopicRelevanceTokens(topic: DbTopicRow) {
  const rawText = [
    topic.title,
    topic.long_title ?? "",
    topic.category ?? "",
    ...(topic.subtopics ?? []),
    ...(topic.tags ?? []),
    ...(topic.keywords ?? []),
  ].join(" ");
  const normalized = normalizeComparableText(rawText);
  const tokens = new Set(
    normalized
      .split(" ")
      .filter((token) => token.length >= 2 && !/^(新聞|焦點|今日|熱門|國際|體育|政治|生活|科技|財經)$/.test(token))
  );

  rawText.match(/[\u4e00-\u9fff]{2,}/g)?.forEach((chunk) => {
    if (chunk.length === 2) {
      tokens.add(chunk);
      return;
    }

    for (let index = 0; index < chunk.length - 1; index += 1) {
      const bigram = chunk.slice(index, index + 2);
      if (!/^(新聞|焦點|今日|熱門|國際|體育|政治|生活|科技|財經)$/.test(bigram)) {
        tokens.add(bigram);
      }
    }
  });

  return [...tokens];
}

function getCoreTitleTokens(topic: DbTopicRow) {
  const rawText = [topic.title, topic.long_title ?? ""].join(" ");
  const tokens = new Set<string>();

  rawText.match(/[\u4e00-\u9fff]{2,}/g)?.forEach((chunk) => {
    if (chunk.length === 2) {
      tokens.add(chunk);
      return;
    }

    for (let index = 0; index < chunk.length - 1; index += 1) {
      const bigram = chunk.slice(index, index + 2);
      if (!/^(新聞|焦點|今日|熱門|國際|體育|政治|生活|科技|財經|台灣|全球)$/.test(bigram)) {
        tokens.add(bigram);
      }
    }
  });

  return [...tokens];
}

function filterRelevantArticles(topic: DbTopicRow, articles: ResponseArticle[]) {
  const relevanceTokens = getTopicRelevanceTokens(topic);
  const coreTitleTokens = getCoreTitleTokens(topic);

  if (relevanceTokens.length === 0) return articles;

  const filtered = articles.filter((article) => {
    const titleText = normalizeComparableText(article.title);
    const bodyText = normalizeComparableText(
      `${article.description} ${article.category} ${article.region}`
    );
    const text = `${titleText} ${bodyText}`;
    const titleCoreCount = coreTitleTokens.filter((token) => titleText.includes(token)).length;
    const bodyCoreCount = coreTitleTokens.filter((token) => bodyText.includes(token)).length;
    const matchedCount = relevanceTokens.filter((token) => text.includes(token)).length;
    const isShortOrGenericTitle = titleText.length < 14 || /重大預告|最新消息|快訊|一次看/.test(article.title);

    if (coreTitleTokens.length > 0) {
      const bodyCoreThreshold = Math.min(2, coreTitleTokens.length);
      return (
        titleCoreCount >= 1 ||
        bodyCoreCount >= bodyCoreThreshold ||
        (isShortOrGenericTitle && bodyCoreCount >= 1)
      );
    }

    return matchedCount >= 1;
  });

  if (coreTitleTokens.length > 0) {
    return filtered;
  }

  return filtered.length > 0 ? filtered : articles;
}

function isGenericTopicSummary(summary: string) {
  return (
    !summary ||
    /熱門新聞共有|焦點集中在最新發展|事件結果與延伸影響|目前尚未產生摘要|系統先以去重後事件整理重點/.test(
      summary
    )
  );
}

function isWeakTopicSummary(summary: string) {
  return (
    isGenericTopicSummary(summary) ||
    summary.length < 44 ||
    /這是目前|焦點之一|重點包括|來源文章追蹤細節|Google News|Yahoo新聞/.test(summary)
  );
}

function stripSummaryNoise(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/Google News|Yahoo新聞|Yahoo奇摩新聞|UDN|聯合新聞網/g, " ")
    .replace(/震撼|驚人|驚爆|驚傳|嚇人/g, "引發關注")
    .replace(/狂！?|太狂了？?/g, "")
    .replace(/懶人包|一次看|一文看懂/g, "重點整理")
    .replace(/網喊|網友炸鍋|網全看傻/g, "引發網路討論")
    .replace(/掀熱議|引爆熱議/g, "引發討論")
    .replace(/買爆/g, "大量採購")
    .replace(/嗆|怒轟/g, "批評")
    .replace(/！+/g, "。")
    .replace(/？+/g, "。")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldSkipSimilarSummary(summary: string, acceptedSummaries: string[]) {
  return acceptedSummaries.some(
    (acceptedSummary) => getTextSimilarity(summary, acceptedSummary) >= 0.72
  );
}

function buildReadableBullets(
  topicBullets: string[] | null,
  articles: ResponseArticle[]
) {
  if (articles.length === 0) {
    return [];
  }

  const articleSummaries: string[] = [];

  articles.forEach((article) => {
    const summary = stripSummaryNoise(article.quickSummary);
    if (summary.length < 12) return;
    if (shouldSkipSimilarSummary(summary, articleSummaries)) return;
    articleSummaries.push(summary);
  });

  if (articleSummaries.length > 0) {
    return articleSummaries.slice(0, 4);
  }

  return Array.isArray(topicBullets) ? topicBullets : [];
}

function buildEventLevelSummary(
  storedSummary: string | null,
  articles: ResponseArticle[]
) {
  const existingSummary = storedSummary ?? "";

  if (articles.length === 0) {
    return "目前已暫時隱藏與主題不匹配的來源，等待下一次同步補上更可靠的相關報導。";
  }

  const sourceNames = getCanonicalSourceNames(articles).slice(0, 4);
  const articleSummaries = buildReadableBullets(null, articles).slice(0, 3);

  if (articleSummaries.length === 0) {
    return existingSummary;
  }

  if (articleSummaries.length === 1) {
    const sourceLabel =
      sourceNames.length > 0 ? `，來源為 ${sourceNames.join("、")}` : "";
    return `目前只保留 1 個與主題高度相關的去重後事件${sourceLabel}。重點是：${articleSummaries[0]}`;
  }

  if (!isWeakTopicSummary(existingSummary) && articleSummaries.length < 2) {
    return existingSummary;
  }

  const sourceText = sourceNames.length
    ? `主要由 ${sourceNames.join("、")} 等來源交叉報導`
    : "已先依去重後事件整理";

  const eventText = articleSummaries.join("；");

  return `${sourceText}，可先抓住 ${articles.length} 個去重後事件：${eventText}`;
}

function normalizeSubtopicsForTopic(topic: DbTopicRow) {
  const text = `${topic.title} ${topic.long_title ?? ""} ${(topic.keywords ?? []).join(" ")}`;

  if (topic.slug === "ai" || topic.rule_key === "ai" || topic.title.trim().toLowerCase() === "ai") {
    return ["模型與產品", "晶片與基礎建設", "機器人與應用", "監管與安全"];
  }

  if (/英特爾|intel|特斯拉|tesla|terafab|台積電|tsmc/i.test(text)) {
    return ["晶圓廠合作", "先進製程", "台積電競爭", "產業分析"];
  }

  if (/槍擊|槍手|公共安全/.test(text)) {
    return ["事件經過", "人員傷亡", "公共安全", "後續調查"];
  }

  if (/t-34|教練機|飛官|墜毀|殉職/i.test(text)) {
    return ["事故經過", "人員傷亡", "調查進度", "飛安檢討"];
  }

  return Array.isArray(topic.subtopics) ? topic.subtopics : [];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const supabase = createServiceRoleClient();

    const { data: topic, error: topicError } = await supabase
      .from("topics")
      .select(`
        id,
        slug,
        title,
        long_title,
        category,
        hero_image_url,
        heat_score,
        source_count,
        article_count,
        last_article_published_at,
        last_synced_at,
        summary,
        bullets,
        subtopics,
        tags,
        rule_key,
        keywords,
        discovery_mode,
        status
      `)
      .eq("slug", slug)
      .eq("status", "active")
      .single<DbTopicRow>();

    if (topicError || !topic) {
      return NextResponse.json(
        {
          ok: false,
          error: "找不到主題",
        },
        { status: 404 }
      );
    }

    const { data: topicArticleRows, error: topicArticlesError } = await supabase
      .from("topic_articles")
      .select("article_id")
      .eq("topic_id", topic.id)
      .returns<DbTopicArticleRow[]>();

    if (topicArticlesError) {
      return NextResponse.json(
        {
          ok: false,
          error: `讀取 topic_articles 失敗: ${topicArticlesError.message}`,
        },
        { status: 500 }
      );
    }

    const articleIds = (topicArticleRows ?? []).map((row) => row.article_id);

    let articles: DbArticleRow[] = [];

    if (articleIds.length > 0) {
      const { data: articleRows, error: articlesError } = await supabase
        .from("articles")
        .select(`
          id,
          title,
          description,
          category,
          region,
          source_id,
          source_name,
          link,
          published_at,
          created_at,
          updated_at
        `)
        .in("id", articleIds)
        .returns<DbArticleRow[]>();

      if (articlesError) {
        return NextResponse.json(
          {
            ok: false,
            error: `讀取 articles 失敗: ${articlesError.message}`,
          },
          { status: 500 }
        );
      }

      const articleMap = new Map<string, DbArticleRow>();
      (articleRows ?? []).forEach((article) => {
        articleMap.set(article.id, article);
      });

      articles = articleIds
        .map((id) => articleMap.get(id))
        .filter((value): value is DbArticleRow => Boolean(value));
    }

    const responseArticles = articles.map((article) => {
      const description = article.description ? cleanRssText(article.description) : "";
      const sourceName = article.source_name ?? "";
      const quickSummary = generateArticleQuickSummary({
        title: article.title,
        description,
        sourceName,
      });

      return {
        id: article.id,
        title: article.title,
        description,
        quickSummary,
        category: article.category ?? "",
        region: article.region ?? "",
        sourceId: article.source_id ?? "",
        sourceName: getCanonicalSourceName({
          sourceName,
          title: article.title,
          description,
        }),
        link: article.link ?? "#",
        publishedAt: article.published_at,
        createdAt: article.created_at,
        updatedAt: article.updated_at,
      };
    });

    const relevantArticles = filterRelevantArticles(topic, responseArticles);
    const dedupedArticles = dedupeSimilarArticles(relevantArticles);
    const relevantSourceCount = getCanonicalSourceNames(relevantArticles).length;
    const effectiveSourceCount = relevantSourceCount;

    const responseBullets = buildReadableBullets(topic.bullets, dedupedArticles);
    const responseSummary = buildEventLevelSummary(
      topic.summary,
      dedupedArticles
    );

    const responseTopic = {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      longTitle: topic.long_title ?? topic.title,
      category: topic.category ?? "",
      heroImageUrl: topic.hero_image_url ?? "",
      heatScore: topic.heat_score ?? 0,
      sourceCount: effectiveSourceCount,
      articleCount: dedupedArticles.length,
      updatedAt:
        topic.last_article_published_at ??
        topic.last_synced_at ??
        new Date().toISOString(),
      summary: responseSummary,
      bullets: responseBullets,
      subtopics: normalizeSubtopicsForTopic(topic),
      tags: Array.isArray(topic.tags) ? topic.tags : [],
      ruleKey: topic.rule_key ?? "",
      keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
      discoveryMode: topic.discovery_mode ?? "rule_based",
      articles: dedupedArticles,
    };

    return NextResponse.json({
      ok: true,
      topic: responseTopic,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";

    return NextResponse.json(
      {
        ok: false,
        error: `db topic detail 執行失敗: ${message}`,
      },
      { status: 500 }
    );
  }
}
