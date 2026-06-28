import crypto from "crypto";
import { cleanRssText } from "@/lib/rss";

export type HistoricalNewsArticle = {
  title: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  description: string;
  category: string;
  region: string;
  query: string;
};

export type GoogleNewsBackfillResult = {
  articles: HistoricalNewsArticle[];
  queryCount: number;
  errors: string[];
};

export const DEFAULT_HISTORICAL_QUERIES = [
  "人工智慧 AI 產業",
  "半導體 晶片 供應鏈",
  "HBM DRAM 記憶體",
  "資料中心 電力 電網",
  "能源 原油 天然氣",
  "原物料 銅 金",
  "央行 利率 通膨",
  "關稅 貿易 供應鏈",
  "生技 醫療 產業",
  "國防 軍工 航太",
  "機器人 自動化",
  "電動車 電池 產業",
  "台海 地緣政治",
  "中東 能源 地緣政治",
];

function getTagValue(xml: string, tagName: string) {
  const escaped = tagName.replace(/:/g, "\\:");
  const match = xml.match(
    new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"),
  );
  return match ? cleanRssText(match[1]) : "";
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function inferCategory(query: string) {
  if (/AI|人工智慧/i.test(query)) return "AI";
  if (/半導體|晶片|HBM|DRAM|記憶體|資料中心|機器人|電動車|電池/i.test(query)) return "科技";
  if (/能源|原油|天然氣|原物料|銅|金|央行|利率|通膨/i.test(query)) return "財經";
  if (/台海/i.test(query)) return "台海";
  if (/地緣政治|中東|國防|軍工|關稅|貿易/i.test(query)) return "國際";
  if (/生技|醫療/i.test(query)) return "生活";
  return "新聞";
}

function cleanGoogleTitle(title: string, sourceName: string) {
  if (!sourceName) return title;
  const suffix = new RegExp(`\\s[-–—]\\s${sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  return title.replace(suffix, "").trim();
}

function isWithinRange(value: string, startDate: string, endDate: string) {
  const date = value.slice(0, 10);
  return date >= startDate && date <= endDate;
}

export function parseGoogleNewsHistoricalRss(
  xml: string,
  input: { query: string; startDate: string; endDate: string },
) {
  return Array.from(xml.matchAll(/<item[\s\S]*?<\/item>/gi))
    .map((match): HistoricalNewsArticle | null => {
      const block = match[0];
      const rawTitle = getTagValue(block, "title");
      const url = getTagValue(block, "link");
      const sourceName = getTagValue(block, "source") || "Google News";
      const pubDate = getTagValue(block, "pubDate");
      const parsedDate = new Date(pubDate);
      if (!rawTitle || !url || Number.isNaN(parsedDate.getTime())) return null;

      const publishedAt = parsedDate.toISOString();
      if (!isWithinRange(publishedAt, input.startDate, input.endDate)) return null;

      return {
        title: cleanGoogleTitle(rawTitle, sourceName),
        url,
        sourceName,
        publishedAt,
        description: getTagValue(block, "description"),
        category: inferCategory(input.query),
        region: /台灣|台海/.test(input.query) ? "TW" : "GLOBAL",
        query: input.query,
      };
    })
    .filter((article): article is HistoricalNewsArticle => Boolean(article));
}

async function fetchQuery(
  query: string,
  startDate: string,
  endDate: string,
) {
  const searchQuery = `${query} after:${startDate} before:${addDays(endDate, 1)}`;
  const params = new URLSearchParams({
    q: searchQuery,
    hl: "zh-TW",
    gl: "TW",
    ceid: "TW:zh-Hant",
  });
  const response = await fetch(
    `https://news.google.com/rss/search?${params.toString()}`,
    {
      headers: {
        "User-Agent": "TrendRadar/1.0 Historical Research",
        Accept: "application/rss+xml, application/xml;q=0.9",
      },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Google News returned ${response.status}`);
  }
  return parseGoogleNewsHistoricalRss(await response.text(), {
    query,
    startDate,
    endDate,
  });
}

export async function fetchGoogleNewsHistoricalMonth(input: {
  startDate: string;
  endDate: string;
  queries?: string[];
}): Promise<GoogleNewsBackfillResult> {
  const start = new Date(`${input.startDate}T00:00:00.000Z`);
  const end = new Date(`${input.endDate}T00:00:00.000Z`);
  const rangeDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (rangeDays < 1 || rangeDays > 31) {
    throw new Error("Automated historical backfill accepts one month or at most 31 days per request.");
  }

  const queries = (input.queries?.length ? input.queries : DEFAULT_HISTORICAL_QUERIES)
    .map((query) => query.trim())
    .filter(Boolean)
    .slice(0, 20);
  const articles: HistoricalNewsArticle[] = [];
  const errors: string[] = [];

  for (let index = 0; index < queries.length; index += 3) {
    const batch = queries.slice(index, index + 3);
    const results = await Promise.allSettled(
      batch.map((query) => fetchQuery(query, input.startDate, input.endDate)),
    );
    results.forEach((result, batchIndex) => {
      if (result.status === "fulfilled") {
        articles.push(...result.value);
      } else {
        errors.push(`${batch[batchIndex]}: ${result.reason instanceof Error ? result.reason.message : "Unknown error"}`);
      }
    });
  }

  const unique = new Map<string, HistoricalNewsArticle>();
  for (const article of articles) {
    const titleKey = article.title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
    const key = article.url || crypto.createHash("sha1").update(titleKey).digest("hex");
    if (!unique.has(key)) unique.set(key, article);
  }

  return {
    articles: [...unique.values()],
    queryCount: queries.length,
    errors,
  };
}
