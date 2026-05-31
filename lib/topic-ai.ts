type TopicAiInputArticle = {
  title: string;
  description?: string;
  sourceName: string;
};

type TopicAiInput = {
  topicTitle: string;
  category: string;
  keywords: readonly string[];
  articles: TopicAiInputArticle[];
};

export type TopicAiOutput = {
  longTitle: string;
  summary: string;
  bullets: string[];
  subtopics: string[];
  tags: string[];
};

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimToSentence(value: string, maxLength: number) {
  const text = compactText(value);
  if (text.length <= maxLength) return text;

  const sentenceEnd = text.slice(0, maxLength).search(/[。！？.!?](?=[^。！？.!?]*$)/);
  if (sentenceEnd > 40) {
    return text.slice(0, sentenceEnd + 1);
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

export function generateArticleQuickSummary(article: TopicAiInputArticle) {
  const title = compactText(article.title);
  const description = compactText(article.description ?? "");

  if (description) {
    const withoutDuplicateTitle = description.startsWith(title)
      ? compactText(description.slice(title.length))
      : description;

    return trimToSentence(withoutDuplicateTitle || description, 140);
  }

  return trimToSentence(
    `這篇新聞由 ${article.sourceName} 報導，重點聚焦於「${title}」的最新進展。`,
    140
  );
}

export async function generateTopicAiSummary(
  input: TopicAiInput
): Promise<TopicAiOutput> {
  const articleTitles = input.articles.map((article) => article.title).slice(0, 5);
  const sourceNames = uniqueStrings(input.articles.map((article) => article.sourceName));

  const longTitle = `${input.topicTitle}成今日熱門焦點`;

  const summary = `近期與「${input.topicTitle}」相關的熱門新聞共有 ${input.articles.length} 篇，主要來自 ${sourceNames.join("、")} 等媒體，焦點集中在最新發展、事件結果與延伸影響。`;

  const bullets =
    articleTitles.length > 0
      ? articleTitles.slice(0, 4)
      : [`近期「${input.topicTitle}」相關新聞持續累積中`];

  const subtopics = input.keywords.slice(0, 4).map((item) => item);
  const tags = input.keywords.slice(0, 4).map((item) => item);

  return {
    longTitle,
    summary,
    bullets,
    subtopics,
    tags,
  };
}
