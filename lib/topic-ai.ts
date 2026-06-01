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
      .replace(/狂飆/g, "上升")
      .replace(/搶下/g, "取得")
      .replace(/爆玄機/g, "引發關注")
      .replace(/嗆/g, "批評")
      .replace(/驚：/g, "表示：")
      .replace(/！+/g, "。")
      .replace(/？+/g, "。")
  );
}

function removeMediaNoise(value: string) {
  return compactText(
    value
      .replace(/\b(Yahoo|Google News|UDN|MSN|LINE TODAY|MoneyDJ)\b/gi, "")
      .replace(/Yahoo新聞|Yahoo股市|工商時報|自由財經|自由時報|中時新聞網|三立新聞網|鉅亨網|聯合新聞網|鏡新聞|中央社/g, "")
      .replace(/\s+/g, " ")
  );
}

function inferQuickSummaryFromSignals(value: string) {
  if (/mlcc|被動元件|高盛|下一個記憶體|ai競賽/i.test(value)) {
    return "高盛與市場報告把部分被動元件視為 AI 伺服器供應鏈的新焦點，投資人正在關注報價、訂單與相關廠商獲利變化。";
  }

  if (/0050|成分股|換股|換血/i.test(value)) {
    return "市場正在關注 0050 成分股調整，相關概念股、傳產與金融股可能受到資金配置變化影響。";
  }

  if (/台海|東海|中國海警|日菲|海域|執法巡查/.test(value)) {
    return "區域海域與執法爭議升溫，多方說法集中在主權、巡查行動與周邊安全情勢。";
  }

  if (/香格里拉|印太|美防長|國防|對台|習近平/.test(value)) {
    return "印太安全議題持續受到關注，美中台相關發言與國防政策成為多家媒體追蹤焦點。";
  }

  return "";
}

function inferTopicSummaryFromSignals(input: TopicAiInput, sourceNames: string[]) {
  const text = `${input.topicTitle} ${input.keywords.join(" ")} ${input.articles
    .map((article) => `${article.title} ${article.description ?? ""}`)
    .join(" ")}`;
  const sourceText = sourceNames.length ? `，目前由 ${sourceNames.join("、")} 等來源追蹤` : "";

  if (/0050|成分股|換股|換血/i.test(text)) {
    return `0050 成分股調整進入市場關注期，焦點在可能納入或剔除的個股，以及 ETF 資金配置變動對 AI 概念股、傳產與金融股的影響${sourceText}。`;
  }

  if (/伊朗|美軍|革命衛隊|德黑蘭|中東/.test(text)) {
    return `伊朗與美軍相關衝突升溫，多家媒體聚焦軍事行動、反擊說法與中東安全情勢後續變化${sourceText}。`;
  }

  if (/東海|台灣以東|中國海警|日菲|執法巡查|海域/.test(text)) {
    return `東海與台海周邊海域議題升溫，報導焦點集中在海域主張、執法巡查與周邊國家互動，後續可能牽動區域安全討論${sourceText}。`;
  }

  if (/美防長|香格里拉|印太|對台|台海|美中/.test(text)) {
    return `美中台海安全論述持續發酵，焦點在美方對台政策表述、印太安全架構，以及相關發言可能造成的外交與安全解讀${sourceText}。`;
  }

  if (/mlcc|被動元件|高盛|下一個記憶體|ai競賽|伺服器/i.test(text)) {
    return `AI 伺服器供應鏈出現新的市場焦點，報導集中在被動元件、報價循環與相關廠商獲利想像，投資人正在觀察訂單與產業趨勢是否延續${sourceText}。`;
  }

  return "";
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
  const title = removeMediaNoise(neutralizeNewsText(removeSourceSuffix(article.title)));
  const description = removeMediaNoise(compactText(article.description ?? ""));
  const inferredSummary = inferQuickSummaryFromSignals(`${title} ${description}`);

  if (inferredSummary) {
    return inferredSummary;
  }

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

  const inferredSummary = inferTopicSummaryFromSignals(input, sourceNames);
  const summary =
    inferredSummary ||
    `近期與「${input.topicTitle}」相關的熱門新聞共有 ${input.articles.length} 篇，主要來自 ${sourceNames.join("、")} 等媒體，焦點集中在最新發展、事件結果與延伸影響。`;

  const articleSummaries = uniqueStrings(
    input.articles
      .map((article) => generateArticleQuickSummary(article))
      .filter((summaryItem) => hasCjkText(summaryItem))
  ).slice(0, 4);

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
