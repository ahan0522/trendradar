import { topicRules } from "@/data/topic-rules";

type NewsArticle = {
  id: string;
  title: string;
  description?: string;
  sourceName: string;
  category?: string;
  link?: string;
  publishedAt: string | null;
};

export type TopicValidationArticle = {
  id: string;
  title: string;
  sourceName: string;
  category: string;
  link: string;
  publishedAt: string | null;
  matchedKeywords: string[];
  categoryAligned: boolean;
};

export type TopicValidationReport = {
  slug: string;
  title: string;
  expectedCategory: string;
  acceptedCategories: string[];
  matchedArticleCount: number;
  alignedArticleCount: number;
  categoryAlignmentRate: number;
  sourceCount: number;
  matchedKeywords: string[];
  confidence: "high" | "medium" | "low";
  warnings: string[];
  sampleArticles: TopicValidationArticle[];
  suspiciousArticles: TopicValidationArticle[];
};

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getAcceptedCategories(category: string) {
  const categoryMap: Record<string, string[]> = {
    AI: ["AI", "3C", "財經", "新聞"],
    "3C": ["3C", "AI", "新聞"],
    國際: ["國際", "新聞"],
    體育: ["體育", "新聞"],
    財經: ["財經", "新聞"],
    娛樂: ["娛樂", "新聞"],
  };

  return categoryMap[category] ?? [category, "新聞"];
}

function getMatchedKeywords(article: NewsArticle, keywords: readonly string[]) {
  const haystack = normalizeText(
    `${article.title} ${article.description ?? ""} ${article.category ?? ""}`
  );

  return keywords.filter((keyword) => haystack.includes(normalizeText(keyword)));
}

function getConfidence(input: {
  matchedArticleCount: number;
  categoryAlignmentRate: number;
  sourceCount: number;
}) {
  if (
    input.matchedArticleCount >= 3 &&
    input.categoryAlignmentRate >= 0.75 &&
    input.sourceCount >= 2
  ) {
    return "high";
  }

  if (input.matchedArticleCount >= 2 && input.categoryAlignmentRate >= 0.5) {
    return "medium";
  }

  return "low";
}

export function validateTopicGrouping(
  articles: NewsArticle[]
): TopicValidationReport[] {
  return topicRules.map((rule) => {
    const acceptedCategories = getAcceptedCategories(rule.category);
    const matchedArticles = articles
      .map((article) => {
        const matchedKeywords = getMatchedKeywords(article, rule.keywords);

        if (matchedKeywords.length === 0) return null;

        const category = article.category ?? "";

        return {
          id: article.id,
          title: article.title,
          sourceName: article.sourceName,
          category,
          link: article.link ?? "",
          publishedAt: article.publishedAt,
          matchedKeywords,
          categoryAligned: acceptedCategories.includes(category),
        } satisfies TopicValidationArticle;
      })
      .filter((article): article is TopicValidationArticle => Boolean(article));

    const alignedArticleCount = matchedArticles.filter(
      (article) => article.categoryAligned
    ).length;

    const matchedArticleCount = matchedArticles.length;
    const categoryAlignmentRate =
      matchedArticleCount > 0 ? alignedArticleCount / matchedArticleCount : 0;
    const sourceCount = new Set(
      matchedArticles.map((article) => article.sourceName)
    ).size;
    const confidence = getConfidence({
      matchedArticleCount,
      categoryAlignmentRate,
      sourceCount,
    });

    const warnings: string[] = [];
    if (matchedArticleCount === 0) {
      warnings.push("目前 RSS 沒有命中這個主題規則。");
    }
    if (matchedArticleCount > 0 && categoryAlignmentRate < 0.5) {
      warnings.push("多數命中文章與主題分類不一致，可能需要調整關鍵字。");
    }
    if (matchedArticleCount >= 3 && sourceCount === 1) {
      warnings.push("命中集中在單一來源，可能是同源重複新聞。");
    }

    return {
      slug: rule.key,
      title: rule.title,
      expectedCategory: rule.category,
      acceptedCategories,
      matchedArticleCount,
      alignedArticleCount,
      categoryAlignmentRate: Number(categoryAlignmentRate.toFixed(2)),
      sourceCount,
      matchedKeywords: uniqueStrings(
        matchedArticles.flatMap((article) => article.matchedKeywords)
      ),
      confidence,
      warnings,
      sampleArticles: matchedArticles.slice(0, 5),
      suspiciousArticles: matchedArticles
        .filter((article) => !article.categoryAligned)
        .slice(0, 5),
    };
  });
}
