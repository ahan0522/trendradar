import { rssSources } from "@/data/rss-sources";
import type { NewsItem, NewsSource } from "@/types/news";

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { createdAt: number; items: NewsItem[] } | null = null;

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

export function cleanRssText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTagValue(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? cleanRssText(match[1]) : "";
}

function getAtomLink(entry: string): string {
  const hrefMatch = entry.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (hrefMatch?.[1]) return decodeHtmlEntities(hrefMatch[1]).trim();
  return getTagValue(entry, "link");
}

function parseDate(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function makeId(source: NewsSource, title: string, link: string): string {
  const base = `${source.id}:${link || title}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash << 5) - hash + base.charCodeAt(i);
    hash |= 0;
  }
  return `${source.id}-${Math.abs(hash)}`;
}

function parseRssItems(xml: string, source: NewsSource): NewsItem[] {
  const itemBlocks = Array.from(xml.matchAll(/<item[\s\S]*?<\/item>/gi)).map((match) => match[0]);
  const atomBlocks = itemBlocks.length
    ? []
    : Array.from(xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)).map((match) => match[0]);

  const blocks = itemBlocks.length ? itemBlocks : atomBlocks;

  return blocks
    .map((block): NewsItem | null => {
      const title = getTagValue(block, "title");
      const link = itemBlocks.length ? getTagValue(block, "link") : getAtomLink(block);
      const description =
        getTagValue(block, "description") ||
        getTagValue(block, "summary") ||
        getTagValue(block, "content");
      const dateValue =
        getTagValue(block, "pubDate") ||
        getTagValue(block, "published") ||
        getTagValue(block, "updated");

      if (!title || !link) return null;

      return {
        id: makeId(source, title, link),
        title,
        link,
        sourceId: source.id,
        sourceName: source.name,
        category: source.category,
        region: source.region,
        sourcePool: source.sourcePool,
        sourceKind: source.sourceKind,
        sourceTier: source.sourceTier,
        sourceWeight: source.sourceWeight,
        credibilityWeight: source.credibilityWeight,
        sourceRole: source.role,
        publishedAt: parseDate(dateValue),
        description,
      } satisfies NewsItem;
    })
    .filter((item): item is NewsItem => Boolean(item));
}

async function fetchSource(source: NewsSource): Promise<NewsItem[]> {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": "TrendRadar/0.2 RSS Reader",
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
    next: { revalidate: 600 },
  });

  if (!response.ok) {
    throw new Error(`${source.name} RSS failed: ${response.status}`);
  }

  const xml = await response.text();
  return parseRssItems(xml, source);
}

export async function getNewsItems(options?: {
  category?: string;
  q?: string;
  limit?: number;
  refresh?: boolean;
}) {
  const now = Date.now();
  const useCache = !!cache && !options?.refresh && now - cache.createdAt < CACHE_TTL_MS;

  let items: NewsItem[];

  if (useCache && cache) {
    items = cache.items;
  } else {
    const enabledSources = rssSources.filter((source) => source.enabled);
    const settled = await Promise.allSettled(enabledSources.map(fetchSource));

    items = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );

    const seen = new Set<string>();
    items = items.filter((item) => {
      const key = item.link || item.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    items.sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });

    cache = { createdAt: now, items };
  }

  const q = options?.q?.trim().toLowerCase() ?? "";
  const category = options?.category ?? "全部";
  const limit = options?.limit ?? 50;

  const filtered = items.filter((item) => {
    const matchCategory = category === "全部" || item.category === category;
    const matchQuery =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.sourceName.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);

    return matchCategory && matchQuery;
  });

  return filtered.slice(0, limit);
}
