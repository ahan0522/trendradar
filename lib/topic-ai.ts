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
      .replace(/\b(cnyes|Newtalk|PNN|Up Media)\b/gi, "")
      .replace(/Yahoo新聞|Yahoo股市|工商時報|自由財經|自由時報|中時新聞網|三立新聞網|鉅亨網|聯合新聞網|鏡新聞|中央社|公視新聞網|上報/g, "")
      .replace(/\s+/g, " ")
  );
}

function inferQuickSummaryFromSignals(value: string) {
  if (/黃敏珊|madison huang|黃仁勳女兒|女兒|廚藝學校|教育理念|追尋所愛/i.test(value)) {
    return "這則來源聚焦黃仁勳家人的職涯選擇與教育觀，補充人物背景與外界對其家庭教育理念的討論。";
  }

  if (/英特爾|陳立武|台積電|張忠謀|魏哲家|合作關係|信賴的合作/i.test(value)) {
    return "英特爾表示將維持與台積電的合作關係，報導焦點在雙方供應鏈互動與先進製程合作是否延續。";
  }

  if (/h200|晶片管制|管制漏洞|解放軍|武器開發|算力/i.test(value)) {
    return "輝達 H200 晶片管制與算力取得問題受到關注，焦點在出口管制是否仍存在漏洞，以及相關技術可能帶來的安全風險。";
  }

  if (/貿聯|vera rubin|gb|ai平台升級|運算及運輸|逐季成長/i.test(value)) {
    return "貿聯看好下半年 AI 伺服器平台升級需求，市場關注 Vera Rubin 等新平台是否帶動連接線與供應鏈營運回升。";
  }

  if (/邁威爾|marvell|兆元企業|股價.*創新高/i.test(value)) {
    return "黃仁勳點名邁威爾的成長潛力後，市場關注 AI 基礎設施需求是否推動相關晶片與網通供應鏈升溫。";
  }

  if (/anthropic|openai最大對手|秘密遞交ipo|ipo申請/i.test(value)) {
    return "Anthropic 傳出準備 IPO，市場焦點在 AI 新創估值、資本市場熱度，以及 OpenAI 競爭格局的變化。";
  }

  if (/所羅門|人形機器人|實體ai|physical ai|自主化/i.test(value)) {
    return "所羅門整合輝達架構推進實體 AI 與人形機器人應用，焦點在機器人自主化與邊緣 AI 落地。";
  }

  if (/鴻海|亞灣|超算|代理ai|ai基建|ai基礎建設/i.test(value)) {
    return "鴻海與輝達合作推進 AI 基礎建設與超算應用，焦點在台灣 AI 基建、代理 AI 與資料中心需求。";
  }

  if (/大賣空|看空|網路泡沫|點名輝達.*泡沫|輝達.*泡沫/i.test(value)) {
    return "市場出現對輝達估值與 AI 題材過熱的疑慮，部分投資人把焦點放在是否重演科技泡沫風險。";
  }

  if (/n1x|pc戰場|聯發科|台積電|rtx spark|consumer laptop chips|computex/i.test(value)) {
    return "輝達在 Computex 期間延伸 PC 與 AI 晶片布局，台積電、聯發科與多家硬體夥伴成為市場關注焦點。";
  }

  if (/黃仁勳|背板股|概念股|漲停|台股|供應鏈|下單畫面/.test(value)) {
    return "黃仁勳相關消息帶動台股與 AI 供應鏈討論，市場焦點集中在概念股、供應鏈名單與資金熱度。";
  }

  if (/韓版|韓國|夥伴之夜|韓方|投資韓國/.test(value)) {
    return "黃仁勳韓國行程引發關注，報導聚焦 NVIDIA 與韓國科技供應鏈、投資合作和產業關係。";
  }

  if (/mlcc|被動元件|高盛|下一個記憶體|ai競賽/i.test(value)) {
    return "高盛與市場報告把部分被動元件視為 AI 伺服器供應鏈的新焦點，投資人正在關注報價、訂單與相關廠商獲利變化。";
  }

  if (/0050|成分股|換股|換血/i.test(value)) {
    return "市場正在關注 0050 成分股調整，相關概念股、傳產與金融股可能受到資金配置變化影響。";
  }

  if (/黎巴嫩|以色列|真主黨|停火|美伊和談|美伊談判/.test(value)) {
    return "中東停火與美伊談判受到關注，焦點在以色列、黎巴嫩與伊朗相關表態是否影響後續區域局勢。";
  }

  if (/伊朗|美軍|革命衛隊|德黑蘭|美伊|科威特|軍事設施/.test(value)) {
    return "伊朗與美軍相關衝突升溫，報導焦點放在軍事行動、反擊說法，以及中東安全局勢是否進一步擴大。";
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

  if (/黎巴嫩|以色列|真主黨|停火|美伊和談|美伊談判/.test(text)) {
    return `中東停火與美伊談判相關消息升溫，報導焦點集中在以色列、黎巴嫩、伊朗與美方斡旋之間的互動，以及局勢是否會進一步擴大${sourceText}。`;
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

function summarizeEnglishSource(title: string) {
  const lowerTitle = title.toLowerCase();

  if (/computex|nvidia|rtx|spark|chip|laptop|pc/.test(lowerTitle)) {
    return "英文來源補充了 Computex、NVIDIA 晶片與裝置新品相關動態，可作為本主題的國際科技背景。";
  }

  return "這篇英文來源補充了本主題的國際背景，系統目前先保留為延伸閱讀來源。";
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
      if (!hasCjkText(cleanedDescription)) {
        return summarizeEnglishSource(title);
      }

      return trimToSentence(cleanedDescription, 120);
    }
  }

  if (hasCjkText(title)) {
    return trimToSentence(`這篇報導指出：${title}`, 120);
  }

  return summarizeEnglishSource(title);
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
