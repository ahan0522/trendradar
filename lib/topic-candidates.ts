type NewsArticle = {
  id: string;
  title: string;
  description?: string;
  sourceName: string;
  category?: string;
  link?: string;
  publishedAt: string | null;
};

export type CandidateTopic = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  keywords: string[];
  articleCount: number;
  sourceCount: number;
  heatScore: number;
  qualityScore: number;
  publishable: boolean;
  rejectionReasons: string[];
  latestPublishedAt: string;
  articles: Array<{
    id: string;
    title: string;
    sourceName: string;
    category: string;
    link: string;
    publishedAt: string | null;
  }>;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "新聞",
  "報導",
  "最新",
  "更多",
  "前往",
  "瀏覽",
  "頭條",
  "觀點",
  "google",
  "news",
  "yahoo",
  "udn",
  "com",
  "www",
  "https",
  "http",
  "cnyes",
  "setn",
  "ettoday",
  "ftnn",
  "newtalk",
  "cna",
  "msn",
  "line",
  "pnn",
  "moneydj",
  "today",
  "快評",
  "下一個",
  "自由",
  "自由體育",
  "自由財經",
  "中央社",
  "中時",
  "工商時報",
  "三立",
  "民視",
  "公視",
  "鏡新聞",
  "新聞網",
  "新聞雲",
  "台灣",
  "全球",
  "國際",
  "體育",
  "財經",
  "科技",
  "娛樂",
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[a-z0-9-]+\.(com|tw|org|net|io|ai)\b/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

function tokenize(value: string) {
  const normalized = normalizeText(value);
  const latinTokens = normalized.match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [];
  const cjkTokens = normalized.match(/[\u4e00-\u9fff]{2,6}/g) ?? [];

  return [...latinTokens, ...cjkTokens]
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        !/^\d+$/.test(token) &&
        !STOP_WORDS.has(token) &&
        ![...STOP_WORDS].some((stopWord) => token.includes(stopWord))
    );
}

function getArticleTokens(article: NewsArticle) {
  return new Set(
    tokenize(`${article.title} ${article.description ?? ""}`)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>) {
  const intersection = [...a].filter((token) => b.has(token)).length;
  if (intersection === 0) return 0;

  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function getLatestPublishedAt(articles: NewsArticle[]) {
  const timestamps = articles
    .map((article) => article.publishedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) return new Date().toISOString();
  return new Date(Math.max(...timestamps)).toISOString();
}

function getDominantCategory(articles: NewsArticle[]) {
  const counts = new Map<string, number>();

  articles.forEach((article) => {
    const category = article.category || "新聞";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });

  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "新聞"
  );
}

function inferCategoryFromSignals(value: string, fallback: string) {
  if (/0050|etf|成分股|換股|換血/.test(value)) {
    return "財經";
  }

  if (/輝達|黃仁勳|nvidia|openai|anthropic|ai|晶片|半導體|伺服器|hbm|記憶體|散熱/.test(value.toLowerCase())) {
    return "AI";
  }

  if (/概念股|股市|台股|美股|金融|傳產|漲停/.test(value)) {
    return "財經";
  }

  if (/中國海警|海警|台海|東海|日菲|美防長|伊朗|美軍|中東|以色列|印太|國防/.test(value)) {
    return "國際";
  }

  if (/nba|mlb|中職|棒球|籃球|悍將|台鋼|投手/.test(value.toLowerCase())) {
    return "體育";
  }

  if (/iphone|android|手機|3c|高通|qualcomm|pc/.test(value.toLowerCase())) {
    return "3C";
  }

  return fallback;
}

function getTopKeywords(articles: NewsArticle[], limit: number) {
  const counts = new Map<string, number>();

  articles.forEach((article) => {
    getArticleTokens(article).forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

function makeCandidateTitle(articles: NewsArticle[], keywords: string[]) {
  const text = `${articles
    .map((article) => article.title)
    .join(" ")} ${keywords.join(" ")}`;
  const ruleBasedTitle = inferTopicTitleFromSignals(text);

  if (ruleBasedTitle) {
    return ruleBasedTitle;
  }

  const representativeTitle = articles
    .map((article) => cleanTitle(article.title))
    .sort((a, b) => a.length - b.length)[0];

  if (representativeTitle) {
    return representativeTitle;
  }

  return keywords.slice(0, 2).join(" / ") || "候選主題";
}

function inferTopicTitleFromSignals(value: string) {
  const text = value.toLowerCase();

  if (/0050|成分股|換股|換血/.test(value)) {
    return "0050 成分股調整";
  }

  if (/黃仁勳|輝達|nvidia|背板|mgx/.test(value)) {
    if (/背板|mgx|供應鏈|台廠|概念股|漲停/.test(value)) {
      return "AI 供應鏈與輝達概念股";
    }

    if (/台積電|聯發科|pc|晶片|n1x/.test(value)) {
      return "輝達、台積電與 AI 晶片";
    }

    return "輝達與黃仁勳動態";
  }

  if (/高通|qualcomm|台積電|供應鏈/.test(value)) {
    return "高通與台灣半導體供應鏈";
  }

  if (/ai競賽|高盛|零件|記憶體|hbm|散熱|電源|伺服器/.test(text)) {
    return "AI 伺服器零件與供應鏈";
  }

  if (/中國海警|海警|台海|東海|日菲|領土主權|執法巡查/.test(value)) {
    return "東海與台海周邊執法爭議";
  }

  if (/美防長|台灣|習近平|彭博|印太|國防|對台/.test(value)) {
    return "美中台海安全論述";
  }

  if (/伊朗|美軍基地|革命衛隊|中東|襲擊美軍|以色列/.test(value)) {
    return "伊朗與美軍基地衝突";
  }

  if (/流星|火流星|nasa|tnt|麻州/.test(value)) {
    return "美國火流星爆炸事件";
  }

  if (/spacex|openai|anthropic|ai資金|資金潮/.test(text)) {
    return "AI 新創與太空科技資金潮";
  }

  if (/中職|悍將|台鋼|棒球|投手/.test(value)) {
    return "台灣棒球賽事動態";
  }

  return "";
}

function makeCandidateSlug(title: string, index: number) {
  const base = [title]
    .join("-")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return base || `candidate-${index + 1}`;
}

function makeCandidateSummary(
  articles: NewsArticle[],
  title: string
) {
  const sourceCount = new Set(articles.map((article) => article.sourceName)).size;

  return `這組新聞聚焦「${title}」，目前有 ${articles.length} 篇文章、${sourceCount} 家來源共同報導，代表多家媒體正在追蹤同一事件。`;
}

function cleanTitle(value: string) {
  return value
    .replace(/^[^：:]{2,12}[：:]/g, "")
    .replace(/！+/g, " ")
    .replace(/？+/g, " ")
    .replace(/「|」|《|》/g, "")
    .replace(/\s+-\s+[^-]{2,40}$/g, "")
    .replace(/\s+\|\s+[^|]{2,40}$/g, "")
    .replace(/\b[a-z0-9-]+\.(com|tw|org|net|io|ai)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function computeHeatScore(articles: NewsArticle[]) {
  const sourceCount = new Set(articles.map((article) => article.sourceName)).size;
  const articleCount = articles.length;
  const now = Date.now();
  const recentCount = articles.filter((article) => {
    if (!article.publishedAt) return false;
    const time = new Date(article.publishedAt).getTime();
    return !Number.isNaN(time) && now - time <= 1000 * 60 * 60 * 6;
  }).length;

  return sourceCount * 30 + articleCount * 10 + recentCount * 20;
}

function evaluateCandidate(input: {
  title: string;
  keywords: string[];
  articleCount: number;
  sourceCount: number;
}) {
  let qualityScore = 0;
  const rejectionReasons: string[] = [];

  if (input.articleCount >= 4) qualityScore += 35;
  else if (input.articleCount >= 2) qualityScore += 20;
  else rejectionReasons.push("文章數不足");

  if (input.sourceCount >= 2) qualityScore += 35;
  else rejectionReasons.push("來源數不足，可能只是單一來源連發");

  if (input.keywords.length >= 3) qualityScore += 15;
  else rejectionReasons.push("可用關鍵字太少");

  if (input.title.length <= 28) qualityScore += 15;
  else if (input.title.length <= 42) qualityScore += 8;
  else rejectionReasons.push("候選名稱仍太像新聞標題");

  return {
    qualityScore,
    publishable: qualityScore >= 70 && rejectionReasons.length === 0,
    rejectionReasons,
  };
}

export function discoverCandidateTopics(
  articles: NewsArticle[],
  options?: {
    maxTopics?: number;
    minArticles?: number;
    similarityThreshold?: number;
  }
): CandidateTopic[] {
  const maxTopics = options?.maxTopics ?? 6;
  const minArticles = options?.minArticles ?? 2;
  const similarityThreshold = options?.similarityThreshold ?? 0.18;

  const articleTokens = new Map<string, Set<string>>();
  articles.forEach((article) => {
    articleTokens.set(article.id, getArticleTokens(article));
  });

  const unused = new Set(articles.map((article) => article.id));
  const clusters: NewsArticle[][] = [];

  for (const seed of articles) {
    if (!unused.has(seed.id)) continue;

    const seedTokens = articleTokens.get(seed.id) ?? new Set<string>();
    const cluster = [seed];
    unused.delete(seed.id);

    for (const candidate of articles) {
      if (!unused.has(candidate.id)) continue;

      const candidateTokens = articleTokens.get(candidate.id) ?? new Set<string>();
      const similarity = jaccardSimilarity(seedTokens, candidateTokens);
      if (similarity >= similarityThreshold) {
        cluster.push(candidate);
        unused.delete(candidate.id);
      }
    }

    if (cluster.length >= minArticles) {
      clusters.push(cluster);
    }
  }

  return clusters
    .map((cluster, index) => {
      const keywords = getTopKeywords(cluster, 6);
      const sourceCount = new Set(cluster.map((article) => article.sourceName)).size;
      const title = makeCandidateTitle(cluster, keywords);
      const signalText = `${title} ${keywords.join(" ")} ${cluster
        .map((article) => `${article.title} ${article.description ?? ""}`)
        .join(" ")}`;
      const category = inferCategoryFromSignals(
        signalText,
        getDominantCategory(cluster)
      );
      const evaluation = evaluateCandidate({
        title,
        keywords,
        articleCount: cluster.length,
        sourceCount,
      });

      return {
        id: `candidate-${index + 1}`,
        slug: makeCandidateSlug(title, index),
        title,
        summary: makeCandidateSummary(cluster, title),
        category,
        keywords,
        articleCount: cluster.length,
        sourceCount,
        heatScore: computeHeatScore(cluster),
        qualityScore: evaluation.qualityScore,
        publishable: evaluation.publishable,
        rejectionReasons: evaluation.rejectionReasons,
        latestPublishedAt: getLatestPublishedAt(cluster),
        articles: cluster.slice(0, 8).map((article) => ({
          id: article.id,
          title: article.title,
          sourceName: article.sourceName,
          category: article.category ?? "",
          link: article.link ?? "",
          publishedAt: article.publishedAt,
        })),
      } satisfies CandidateTopic;
    })
    .sort((a, b) => b.heatScore - a.heatScore)
    .filter((topic, index, topics) => {
      const normalizedTitle = normalizeText(topic.title);
      return (
        topics.findIndex((item) => normalizeText(item.title) === normalizedTitle) ===
        index
      );
    })
    .slice(0, maxTopics);
}
