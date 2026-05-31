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

function hasCjkText(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

function removeSourceSuffix(value: string) {
  return compactText(
    value
      .replace(/\s+-\s+[^-｜|]{2,30}$/g, "")
      .replace(/\s+\|\s+[^｜|]{2,30}$/g, "")
      .replace(/\s+[\u4e00-\u9fffA-Za-z0-9]+新聞網$/g, "")
  );
}

function neutralizeNewsText(value: string) {
  return compactText(
    value
      .replace(/眼紅了？?/g, "")
      .replace(/買爆/g, "大量採購")
      .replace(/爆玄機/g, "引發關注")
      .replace(/嗆/g, "批評")
      .replace(/驚：/g, "表示：")
      .replace(/！+/g, "。")
      .replace(/？+/g, "。")
  );
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
  const title = neutralizeNewsText(removeSourceSuffix(article.title));
  const description = compactText(article.description ?? "");

  if (description) {
    const withoutDuplicateTitle = description.startsWith(title)
      ? compactText(description.slice(title.length))
      : description;
    const cleanedDescription = neutralizeNewsText(removeSourceSuffix(withoutDuplicateTitle));

    if (cleanedDescription && cleanedDescription.length > 16) {
      return trimToSentence(cleanedDescription, 120);
    }
  }

  if (hasCjkText(title)) {
    return trimToSentence(`這篇報導指出：${title}`, 120);
  }

  return trimToSentence(
    `這篇報導補充了與本主題相關的最新情況，系統會在後續 AI 摘要中進一步整理重點。`,
    120
  );
}

export async function generateTopicAiSummary(
  input: TopicAiInput
): Promise<TopicAiOutput> {
  const sourceNames = uniqueStrings(input.articles.map((article) => article.sourceName));

  const longTitle = `${input.topicTitle}成今日熱門焦點`;

  const summary = `近期與「${input.topicTitle}」相關的熱門新聞共有 ${input.articles.length} 篇，主要來自 ${sourceNames.join("、")} 等媒體，焦點集中在最新發展、事件結果與延伸影響。`;

  const articleSummaries = input.articles
    .map((article) => generateArticleQuickSummary(article))
    .filter((summaryItem) => hasCjkText(summaryItem))
    .slice(0, 4);

  const bullets =
    articleSummaries.length > 0
      ? articleSummaries
      : [
          `多家來源正在報導「${input.topicTitle}」的最新發展。`,
          "目前資訊仍在累積，後續同步會持續更新事件脈絡。",
        ];

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
