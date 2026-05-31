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