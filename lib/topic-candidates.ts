import {
  computeWeightedHeatScore,
  getEffectiveSourceCount,
  getRawSourceCount,
} from "@/lib/source-scoring";
import type { SourceKind, SourcePool, SourceRole, SourceTier } from "@/types/news";

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

export type CandidateTopic = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  keywords: string[];
  articleCount: number;
  sourceCount: number;
  rawSourceCount: number;
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

const SIGNAL_KEYWORDS = [
  "中國海警",
  "台灣東部海域",
  "專屬經濟區",
  "執法巡查",
  "海委會",
  "東海",
  "台海",
  "日菲",
  "伊朗",
  "美軍基地",
  "革命衛隊",
  "德黑蘭",
  "中東",
  "以色列",
  "黎巴嫩",
  "真主黨",
  "停火",
  "美伊談判",
  "美伊和談",
  "輝達",
  "黃仁勳",
  "台積電",
  "0050",
  "成分股",
  "AI 伺服器",
  "MLCC",
  "Meta",
  "Instagram",
  "Sony",
  "NBA",
  "羽球",
  "周天成",
  "印尼賽",
  "iPhone",
  "關稅",
  "強降雨",
  "豪雨",
  "暴雨",
  "淹水",
  "停班停課",
  "南韓地方選舉",
  "法網",
  "梁恩碩",
  "故宮",
  "金曲",
  "影展",
  "外交部",
  "國防部",
  "普丁",
  "澤倫斯基",
  "俄烏",
  "電競",
];

const EMBEDDED_MEDIA_NAMES = [
  "中央社",
  "自由時報",
  "自由財經",
  "自由體育",
  "Yahoo",
  "UDN",
  "聯合新聞網",
  "工商時報",
  "公視",
  "ETtoday",
  "三立",
  "民視",
  "東森",
  "NOWnews",
  "中時",
  "鉅亨",
  "MoneyDJ",
  "rti",
  "LINE TODAY",
  "Harper",
  "PChome",
];

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

function normalizeContentFingerprint(value: string) {
  return normalizeText(value)
    .replace(/google news|yahoo|中央社|自由時報|中時新聞網|聯合新聞網/gi, " ")
    .replace(/記者|編譯|報導|快訊|獨家/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getArticleFingerprint(article: NewsArticle) {
  const text = normalizeContentFingerprint(
    `${cleanTitle(article.title)} ${article.description ?? ""}`
  );
  const tokens = tokenize(text)
    .filter((token) => token.length >= 2)
    .slice(0, 18);

  return tokens.join("|") || text.slice(0, 80);
}

function dedupeClusterArticles(articles: NewsArticle[]) {
  const groups = new Map<string, NewsArticle[]>();

  articles.forEach((article) => {
    const fingerprint = getArticleFingerprint(article);
    groups.set(fingerprint, [...(groups.get(fingerprint) ?? []), article]);
  });

  return [...groups.values()].map((group) =>
    [...group].sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

      if (bTime !== aTime) return bTime - aTime;

      const aWeight = (a.sourceWeight ?? 1) * (a.credibilityWeight ?? 1);
      const bWeight = (b.sourceWeight ?? 1) * (b.credibilityWeight ?? 1);
      return bWeight - aWeight;
    })[0]
  );
}

function getEmbeddedSourceCount(article: NewsArticle) {
  const text = `${article.title} ${article.description ?? ""}`;

  if (article.sourceKind !== "aggregator" && !article.sourceName.includes("Google News")) {
    return 0;
  }

  return EMBEDDED_MEDIA_NAMES.filter((sourceName) =>
    text.toLowerCase().includes(sourceName.toLowerCase())
  ).length;
}

function getEmbeddedSourceScore(articles: NewsArticle[]) {
  return Math.max(0, ...articles.map(getEmbeddedSourceCount));
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
  if (/中國海警|海警|台海|東海|日菲|美防長|印太|國防|軍演|外交部|國防部|兩岸|共軍|解放軍|台灣海峽/.test(value)) {
    return "台海";
  }

  if (/強降雨|豪雨|暴雨|颱風|熱帶低壓|地震|淹水|停班停課|災害|防災|氣象|寒流|高溫/.test(value)) {
    return "生活";
  }

  if (/展覽|博物館|故宮|文化部|影展|金曲|金馬|文學|出版|藝術|表演|劇場/.test(value)) {
    return "文化";
  }

  if (/t-34|教練機|飛官|軍機|墜毀|殉職|相驗/i.test(value)) {
    return "新聞";
  }

  if (/playstation|ps5|state of play|god of war|atlantis|trailer|gameplay|nintendo|xbox|steam|遊戲/i.test(value)) {
    return "遊戲";
  }

  if (/俄羅斯|烏克蘭|基輔|空襲|襲擊|普丁|澤倫斯基|停火談判|russia|ukraine|kyiv/i.test(value)) {
    return "國際";
  }

  if (/黎巴嫩|以色列|真主黨|停火|美伊和談|美伊談判|中東/.test(value)) {
    return "國際";
  }

  if (/股價|投信|外資|買超|賣超|三大法人|合併營收|月營收|eps|每股盈餘|殖利率|本益比|除息|除權|法說|目標價|漲停|跌停|買這\d+檔|買進|個股|股票|概念股|報價|調漲價格|華新科|mlcc/.test(value.toLowerCase())) {
    return "財經";
  }

  if (/員工薪酬|平均薪資|薪資破|薪酬|日月光/.test(value)) {
    return "財經";
  }

  if (/0050|etf|成分股|換股|換血/.test(value)) {
    return "財經";
  }

  if (/關稅|301調查|美擬對台徵|貿易談判|重建關稅壁壘/.test(value)) {
    return "國際";
  }

  if (/輝達|黃仁勳|nvidia|晶片|半導體|伺服器|hbm|記憶體|散熱|台積電|聯發科|高通|qualcomm/.test(value.toLowerCase())) {
    return "科技";
  }

  if (/openai|anthropic|生成式ai|生成式 ai|ai模型|人工智慧|llm|大型語言模型/.test(value.toLowerCase())) {
    return "AI";
  }

  if (/概念股|股市|台股|美股|金融|傳產|漲停/.test(value)) {
    return "財經";
  }

  if (/伊朗|美軍|中東|以色列|黎巴嫩|真主黨|停火|俄羅斯|烏克蘭/.test(value)) {
    return "國際";
  }

  if (/nba|mlb|中職|棒球|籃球|悍將|台鋼|投手|羽球|周天成|戴資穎|印尼賽|男單|女單/.test(value.toLowerCase())) {
    return "體育";
  }

  if (/法網|網球|女雙|大滿貫|謝淑薇|梁恩碩/.test(value)) {
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
    const text = `${article.title} ${article.description ?? ""}`;

    SIGNAL_KEYWORDS.forEach((keyword) => {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        counts.set(keyword, (counts.get(keyword) ?? 0) + 3);
      }
    });

    getArticleTokens(article).forEach((token) => {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([token]) => !SIGNAL_KEYWORDS.some((keyword) => keyword !== token && keyword.includes(token)))
    .slice(0, limit)
    .map(([token]) => token);
}

function getClusterText(articles: NewsArticle[]) {
  return articles
    .map((article) => `${article.title} ${article.description ?? ""}`)
    .join(" ");
}

function hasMiddleEastConflictSignal(value: string) {
  return /伊朗|美軍|美伊|中東|以色列|黎巴嫩|真主黨|停火|革命衛隊|德黑蘭/.test(
    value
  );
}

function shouldMergeClusters(a: NewsArticle[], b: NewsArticle[]) {
  const aText = getClusterText(a);
  const bText = getClusterText(b);

  if (hasMiddleEastConflictSignal(aText) && hasMiddleEastConflictSignal(bText)) {
    return true;
  }

  const aKeywords = new Set(getTopKeywords(a, 8));
  const bKeywords = new Set(getTopKeywords(b, 8));
  const overlapCount = [...aKeywords].filter((keyword) =>
    bKeywords.has(keyword)
  ).length;

  if (overlapCount < 3) return false;

  const combinedCategory = inferCategoryFromSignals(
    `${aText} ${bText}`,
    getDominantCategory([...a, ...b])
  );
  const sameCategory =
    inferCategoryFromSignals(aText, getDominantCategory(a)) === combinedCategory &&
    inferCategoryFromSignals(bText, getDominantCategory(b)) === combinedCategory;

  return sameCategory;
}

function mergeRelatedClusters(clusters: NewsArticle[][]) {
  const merged: NewsArticle[][] = [];

  for (const cluster of clusters) {
    const matchedCluster = merged.find((existingCluster) =>
      shouldMergeClusters(existingCluster, cluster)
    );

    if (matchedCluster) {
      const links = new Set(matchedCluster.map((article) => article.link));
      cluster.forEach((article) => {
        if (!links.has(article.link)) {
          matchedCluster.push(article);
        }
      });
      continue;
    }

    merged.push([...cluster]);
  }

  return merged;
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

  if (/關稅|301調查|美擬對台徵|貿易談判|重建關稅壁壘/.test(value)) {
    return "美國對台關稅與貿易談判";
  }

  if (/強降雨|豪雨|西南風|熱帶低壓|降雨熱區|旱象|雨神/.test(value)) {
    return "台灣強降雨與防災提醒";
  }

  if (/普丁|澤倫斯基|俄羅斯|烏克蘭|俄烏|停火談判|和平談判/.test(value)) {
    return "俄烏戰爭與和平談判";
  }

  if (/南韓地方選舉|韓國地方選舉|尹錫悅|李在明|執政黨/.test(value)) {
    return "南韓地方選舉與政局變化";
  }

  if (/法網|梁恩碩|女雙|大滿貫|謝淑薇/.test(value)) {
    return "法網台將女雙賽事";
  }

  if (/直升機|墜機|墜落|海軍.*喪生|軍機.*事故/.test(value)) {
    return "軍機墜落事故";
  }

  if (/捲款|潛逃|詐欺|檢警介入|受害者/.test(value)) {
    return "台中火鍋店捲款案";
  }

  if (/playstation|ps5|state of play|god of war|laufey|atlantis|trailer|gameplay/i.test(value)) {
    return "PlayStation 遊戲發表動態";
  }

  if (/電競選手|電競|後輩|浪費時間|職業選手|職涯/i.test(value)) {
    return "電競選手職涯現實討論";
  }

  if (/trump|executive order|ai models?|review|released|white house/i.test(value)) {
    return "美國 AI 模型發布審查政策";
  }

  if (/人型機器人|具身\s*ai|機器人平台|新漢|高通|computex/i.test(value)) {
    return "具身 AI 機器人平台發表";
  }

  if (/俄羅斯|烏克蘭|基輔|空襲|大規模襲擊|多人遇難|russia|ukraine|kyiv/i.test(value)) {
    return "俄烏戰爭新一輪空襲";
  }

  if (/t-34|教練機|飛官|墜毀|殉職|橋檢|相驗/i.test(value)) {
    return "T-34 教練機墜毀事故";
  }

  if (/火星|暖水|隕石坑|宜居|古隕石坑|科學最新研究/.test(value)) {
    return "火星古環境與宜居研究";
  }

  if (/員工薪酬|平均薪資|薪資破|薪酬/.test(value) && /日月光|台積電|半導體/.test(value)) {
    return "半導體員工薪酬排行";
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

  if (/高通|qualcomm/.test(value) && /台積電|供應鏈|半導體/.test(value)) {
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

  if (/黎巴嫩|以色列|真主黨|停火|美伊和談|美伊談判/.test(value)) {
    return "中東停火與美伊談判";
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

  if (/羽球|周天成|戴資穎|印尼賽|男單|女單|直落二/.test(value)) {
    return "台灣羽球賽事動態";
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
  const sourceCount = getEffectiveSourceCount(articles);

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

function titleHasSourceEvidence(title: string, articles: NewsArticle[]) {
  const sourceText = articles
    .map((article) => `${article.title} ${article.description ?? ""}`)
    .join(" ");

  if (title === "AI 伺服器零件與供應鏈") {
    return /ai|高盛|mlcc|零件|記憶體|伺服器/i.test(sourceText);
  }

  if (title === "0050 成分股調整") {
    return /0050|成分股|換股|換血/.test(sourceText);
  }

  if (title === "美國對台關稅與貿易談判") {
    return /關稅|301調查|美擬對台徵|貿易談判|重建關稅壁壘/.test(sourceText);
  }

  if (title === "台灣強降雨與防災提醒") {
    return /強降雨|豪雨|西南風|熱帶低壓|降雨熱區|旱象|雨神/.test(sourceText);
  }

  if (title === "南韓地方選舉與政局變化") {
    return /南韓地方選舉|韓國地方選舉|尹錫悅|李在明|執政黨/.test(sourceText);
  }

  if (title === "法網台將女雙賽事") {
    return /法網|梁恩碩|女雙|大滿貫|謝淑薇/.test(sourceText);
  }

  if (title === "軍機墜落事故") {
    return /直升機|墜機|墜落|海軍.*喪生|軍機.*事故/.test(sourceText);
  }

  if (title === "台中火鍋店捲款案") {
    return /捲款|潛逃|詐欺|檢警介入|受害者/.test(sourceText);
  }

  if (title === "PlayStation 遊戲發表動態") {
    return /playstation|ps5|state of play|god of war|laufey|atlantis|trailer|gameplay/i.test(sourceText);
  }

  if (title === "電競選手職涯現實討論") {
    return /電競選手|電競|後輩|浪費時間|職業選手|職涯/i.test(sourceText);
  }

  if (title === "美國 AI 模型發布審查政策") {
    return /trump|executive order|ai models?|review|released|white house/i.test(sourceText);
  }

  if (title === "具身 AI 機器人平台發表") {
    return /人型機器人|具身\s*ai|機器人平台|新漢|高通|computex/i.test(sourceText);
  }

  if (title === "俄烏戰爭新一輪空襲") {
    return /俄羅斯|烏克蘭|基輔|空襲|大規模襲擊|多人遇難|russia|ukraine|kyiv/i.test(sourceText);
  }

  if (title === "俄烏戰爭與和平談判") {
    return /普丁|澤倫斯基|俄羅斯|烏克蘭|俄烏|停火談判|和平談判|russia|ukraine/i.test(sourceText);
  }

  if (title === "T-34 教練機墜毀事故") {
    return /t-34|教練機|飛官|墜毀|殉職|相驗/i.test(sourceText);
  }

  if (title === "火星古環境與宜居研究") {
    return /火星|暖水|隕石坑|宜居|古環境/.test(sourceText);
  }

  if (title === "伊朗與美軍基地衝突") {
    return /伊朗|美軍|革命衛隊|德黑蘭/.test(sourceText);
  }

  if (title === "中東停火與美伊談判") {
    return /黎巴嫩|以色列|真主黨|停火|美伊和談|美伊談判|伊朗/.test(sourceText);
  }

  if (title === "東海與台海周邊執法爭議") {
    return /東海|台灣以東|日菲|中國海警|執法巡查/.test(sourceText);
  }

  if (title === "美中台海安全論述") {
    return /美國|美防長|台灣|台海|香格里拉|印太/.test(sourceText);
  }

  if (title === "半導體員工薪酬排行") {
    return /員工薪酬|平均薪資|薪資破|薪酬|日月光|台積電/.test(sourceText);
  }

  if (title === "台灣羽球賽事動態") {
    return /羽球|周天成|戴資穎|印尼賽|男單|女單|直落二/.test(sourceText);
  }

  const titleTokens = tokenize(title).filter((token) => token.length >= 2);
  if (titleTokens.length === 0) return true;

  const articleText = normalizeText(sourceText);

  const matchedTokenCount = titleTokens.filter((token) =>
    articleText.includes(token)
  ).length;

  return matchedTokenCount >= Math.min(2, titleTokens.length);
}

function hasStrongEventSignal(title: string, keywords: string[]) {
  const text = `${title} ${keywords.join(" ")}`.toLowerCase();

  return /0050|etf|伊朗|美軍|黎巴嫩|以色列|停火|台海|東海|中國海警|墜毀|殉職|事故|地震|颱風|豪雨|強降雨|熱帶低壓|關稅|貿易談判|罷免|選舉|法網|梁恩碩|羽球|周天成|印尼賽|普丁|澤倫斯基|俄烏|烏克蘭|俄羅斯|電競|遊戲|財報|營收|併購|ai|輝達|黃仁勳|高盛|mlcc|openai|spacex|nba|iphone/.test(
    text
  );
}

function hasOnlySourceConcentrationWarning(rejectionReasons: string[]) {
  return rejectionReasons.every((reason) =>
    reason.includes("有效來源仍偏集中")
  );
}

function hasOnlyAggregationWarning(rejectionReasons: string[]) {
  return rejectionReasons.every(
    (reason) =>
      reason.includes("平台聚合單篇") ||
      reason.includes("有效來源仍偏集中")
  );
}

function isLowValueTopic(title: string, keywords: string[]) {
  const text = `${title} ${keywords.join(" ")}`;

  if (/大樂透|威力彩|今彩|雙贏彩|開獎|頭獎|中獎號碼|彩券|命理|生肖|星座|財運|上上籤/.test(text)) {
    return true;
  }

  if (/chill|台啤|辦桌|紅豆餅|刈包|吃不停|年薪|職缺|徵才|網嗨翻|內行人/.test(text.toLowerCase())) {
    return true;
  }

  if (/韓職|王彥程|明星賽票選|中華職棒|mvp/i.test(text)) {
    return true;
  }

  if (
    /股價|投信|外資|買超|賣超|三大法人|合併營收|月營收|營收\d|eps|每股盈餘|殖利率|本益比|除息|除權|法說|目標價|漲停|跌停|買這\d+檔|現在就買|買進|個股|股票|概念股|報價|調漲價格|華新科|mlcc/i.test(text) &&
    !/0050|etf|成分股|換股|換血/i.test(text)
  ) {
    return true;
  }

  return false;
}

function hasStandaloneDigestSignal(article: NewsArticle) {
  if (getEmbeddedSourceCount(article) < 3) return false;

  const text = `${article.title} ${article.description ?? ""}`;
  const title = inferTopicTitleFromSignals(text);
  if (!title) return false;

  const keywords = getTopKeywords([article], 6);

  return hasStrongEventSignal(title, keywords) && !isLowValueTopic(title, keywords);
}

function evaluateCandidate(input: {
  title: string;
  keywords: string[];
  articleCount: number;
  sourceCount: number;
  rawSourceCount: number;
  embeddedSourceCount: number;
  articles: NewsArticle[];
}) {
  let qualityScore = 0;
  const rejectionReasons: string[] = [];
  const lowValueTopic = isLowValueTopic(input.title, input.keywords);
  const strongEventSignal = hasStrongEventSignal(input.title, input.keywords);

  if (input.articleCount >= 4) qualityScore += 35;
  else if (input.articleCount >= 2) qualityScore += 20;
  else if (input.embeddedSourceCount >= 3 && strongEventSignal) {
    qualityScore += 18;
    rejectionReasons.push("平台聚合單篇，需後續來源補強");
  }
  else rejectionReasons.push("文章數不足");

  if (input.sourceCount >= 2) qualityScore += 35;
  else if (input.rawSourceCount >= 2 && input.articleCount >= 3) {
    qualityScore += 18;
    rejectionReasons.push("有效來源仍偏集中，可能只是同一媒體不同分類轉載");
  } else if (input.rawSourceCount >= 2 && strongEventSignal) {
    qualityScore += 15;
    rejectionReasons.push("有效來源仍偏集中，可能只是同一媒體不同分類轉載");
  }
  else rejectionReasons.push("來源數不足，可能只是單一來源連發");

  if (input.keywords.length >= 3) qualityScore += 15;
  else rejectionReasons.push("可用關鍵字太少");

  if (input.title.length <= 28) qualityScore += 15;
  else if (input.title.length <= 42) qualityScore += 8;
  else rejectionReasons.push("候選名稱仍太像新聞標題");

  if (titleHasSourceEvidence(input.title, input.articles)) {
    qualityScore += 10;
  } else {
    qualityScore -= 25;
    rejectionReasons.push("候選名稱缺少來源文章佐證");
  }

  if (input.articleCount === 2 && input.sourceCount === 2) {
    if (strongEventSignal) {
      qualityScore += 5;
    } else {
      qualityScore -= 20;
      rejectionReasons.push("兩篇文章候選缺少明確事件訊號");
    }
  }

  if (lowValueTopic) {
    qualityScore -= 40;
    rejectionReasons.push("低資訊量或單股市場訊息，不適合作為大主題");
  }

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  const sourceConcentratedButPublishable =
    strongEventSignal &&
    input.rawSourceCount >= 2 &&
    input.articleCount >= 2 &&
    qualityScore >= 78 &&
    hasOnlySourceConcentrationWarning(rejectionReasons);
  const aggregatedDigestPublishable =
    strongEventSignal &&
    input.articleCount === 1 &&
    input.embeddedSourceCount >= 3 &&
    input.sourceCount >= 3 &&
    qualityScore >= 78 &&
    hasOnlyAggregationWarning(rejectionReasons);

  return {
    qualityScore,
    publishable:
      (qualityScore >= 78 && rejectionReasons.length === 0 ||
        sourceConcentratedButPublishable ||
        aggregatedDigestPublishable) &&
      !lowValueTopic,
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
  const smallClusterArticles: NewsArticle[] = [];

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
    } else {
      smallClusterArticles.push(...cluster);
    }
  }

  if (clusters.length < maxTopics) {
    const seenStandaloneLinks = new Set<string>();
    const standaloneDigests = articles
      .filter((article) => smallClusterArticles.some((item) => item.id === article.id))
      .filter((article) => {
        const link = article.link || article.id;
        if (seenStandaloneLinks.has(link)) return false;
        seenStandaloneLinks.add(link);
        return true;
      })
      .filter(hasStandaloneDigestSignal)
      .sort((a, b) => {
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;

        return bTime - aTime;
      })
      .slice(0, maxTopics - clusters.length);

    standaloneDigests.forEach((article) => {
      clusters.push([article]);
    });
  }

  return mergeRelatedClusters(clusters)
    .map((cluster, index) => {
      const representativeCluster = dedupeClusterArticles(cluster);
      const keywords = getTopKeywords(cluster, 6);
      const embeddedSourceCount = getEmbeddedSourceScore(cluster);
      const effectiveSourceCount = Math.max(
        getEffectiveSourceCount(representativeCluster),
        embeddedSourceCount
      );
      const rawSourceCount = Math.max(getRawSourceCount(cluster), embeddedSourceCount);
      const title = makeCandidateTitle(representativeCluster, keywords);
      const sourceCount = effectiveSourceCount;
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
        articleCount: representativeCluster.length,
        sourceCount,
        rawSourceCount,
        embeddedSourceCount,
        articles: representativeCluster,
      });

      return {
        id: `candidate-${index + 1}`,
        slug: makeCandidateSlug(title, index),
        title,
        summary: makeCandidateSummary(representativeCluster, title),
        category,
        keywords,
        articleCount: representativeCluster.length,
        sourceCount,
        rawSourceCount,
        heatScore: computeWeightedHeatScore(cluster),
        qualityScore: evaluation.qualityScore,
        publishable: evaluation.publishable,
        rejectionReasons: evaluation.rejectionReasons,
        latestPublishedAt: getLatestPublishedAt(cluster),
        articles: representativeCluster.slice(0, 8).map((article) => ({
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
