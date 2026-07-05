export type HistoricalVerificationCandidate = {
  id: string;
  title: string;
  sourceName: string;
  category?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  link?: string | null;
};

const investablePattern =
  /人工智慧|\bAI\b|半導體|晶片|HBM|DRAM|NAND|記憶體|資料中心|電力|電網|變壓器|能源|原油|天然氣|銅|利率|通膨|關稅|供應鏈|生技|醫療|國防|軍工|機器人|自動化|電動車|電池|光通訊|CPO|CoWoS/i;
const noisePattern =
  /買超|賣超|投信|外資|目標價|EPS|每股盈餘|月營收|合併營收|漲停|跌停|盤中|收盤|存股|殖利率|\bETF\b|法人點名|個股|NBA|MLB|棒球|籃球|足球|網球|演唱會|藝人|動漫|遊戲|旅遊|美食/i;
const primarySourcePattern =
  /政府|部會|證交所|櫃買|公開資訊觀測站|公司公告|投資人關係|法說|moea\.gov\.tw|gov\.tw|sec\.gov|federalreserve\.gov|iea\.org/i;
const trustedSourcePattern =
  /中央社|CNA|iThome|TechNews|科技新報|TrendForce|DIGITIMES|Reuters|路透|Nikkei|日經|Financial Times|華爾街日報|工商時報|經濟日報|MoneyDJ/i;
const lowValueSourcePattern =
  /Google News|Yahoo|LINE TODAY|MSN|CMoney|鉅亨號|PChome|蕃新聞|商傳媒|投資網誌/i;

const sourceDomains: Array<[RegExp, string]> = [
  [/iThome/i, "ithome.com.tw"],
  [/中央社|\bCNA\b/i, "cna.com.tw"],
  [/TechNews|科技新報/i, "technews.tw"],
  [/TrendForce/i, "trendforce.com"],
  [/DIGITIMES/i, "digitimes.com"],
  [/Reuters|路透/i, "reuters.com"],
  [/工商時報/i, "ctee.com.tw"],
  [/經濟日報/i, "money.udn.com"],
  [/MoneyDJ/i, "moneydj.com"],
  [/moea\.gov\.tw|經濟部/i, "moea.gov.tw"],
];

export function historicalVerificationPriority(
  candidate: HistoricalVerificationCandidate,
) {
  const text = `${candidate.category ?? ""} ${candidate.title} ${candidate.sourceName}`;
  let score = 0;
  if (investablePattern.test(text)) score += 45;
  if (primarySourcePattern.test(candidate.sourceName)) score += 35;
  else if (trustedSourcePattern.test(candidate.sourceName)) score += 25;
  if (candidate.publishedAt && candidate.createdAt) score += 5;
  if (noisePattern.test(text)) score -= 70;
  if (lowValueSourcePattern.test(candidate.sourceName)) score -= 35;
  if (!candidate.sourceName.trim()) score -= 25;
  return score;
}

export function sourceDomainHint(sourceName: string) {
  const normalized = sourceName.trim().toLowerCase();
  if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}$/.test(normalized)) {
    return normalized.replace(/^www\./, "");
  }
  return sourceDomains.find(([pattern]) => pattern.test(sourceName))?.[1] ?? null;
}

export function buildHistoricalVerificationSearchQuery(
  candidate: HistoricalVerificationCandidate,
) {
  const escapedTitle = candidate.title.replace(/"/g, "").trim();
  const domain = sourceDomainHint(candidate.sourceName);
  return `${domain ? `site:${domain} ` : ""}"${escapedTitle}" ${
    domain ? "" : candidate.sourceName
  }`.trim();
}

export function rankHistoricalVerificationCandidates(
  candidates: HistoricalVerificationCandidate[],
  limit = 50,
) {
  return candidates
    .map((candidate) => ({
      ...candidate,
      priority: historicalVerificationPriority(candidate),
      sourceDomainHint: sourceDomainHint(candidate.sourceName),
      searchQuery: buildHistoricalVerificationSearchQuery(candidate),
    }))
    .filter((candidate) => candidate.priority > 0)
    .sort((left, right) =>
      right.priority - left.priority ||
      String(left.publishedAt ?? "").localeCompare(String(right.publishedAt ?? "")) ||
      left.id.localeCompare(right.id)
    )
    .slice(0, Math.max(1, Math.min(limit, 500)));
}
