export type HistoricalPageMetadata = {
  title: string | null;
  publishedAt: string | null;
  publishedAtMethod: string | null;
};

export type WaybackCapture = {
  timestamp: string;
  capturedAt: string;
  originalUrl: string;
  statusCode: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    );
}

function validIso(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function metaContent(html: string, names: string[]) {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
        "i",
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*>`,
        "i",
      ),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtml(match[1].trim());
    }
  }
  return null;
}

function jsonLdValues(html: string) {
  const values: unknown[] = [];
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      values.push(JSON.parse(decodeHtml(match[1].trim())));
    } catch {
      // Invalid third-party JSON-LD is ignored; other metadata may still work.
    }
  }
  return values;
}

function findJsonLdString(value: unknown, key: string): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJsonLdString(item, key);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row[key] === "string") return row[key] as string;
  for (const child of Object.values(row)) {
    const found = findJsonLdString(child, key);
    if (found) return found;
  }
  return null;
}

export function parseHistoricalPageMetadata(html: string): HistoricalPageMetadata {
  const jsonLd = jsonLdValues(html);
  const jsonLdTitle = jsonLd
    .map((value) => findJsonLdString(value, "headline") ?? findJsonLdString(value, "name"))
    .find(Boolean) ?? null;
  const jsonLdDate = jsonLd
    .map((value) => findJsonLdString(value, "datePublished"))
    .find((value) => validIso(value)) ?? null;

  const resolvedTitle = jsonLdTitle ??
    metaContent(html, ["og:title", "twitter:title"]) ??
    decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "");
  const metaDate = metaContent(html, [
    "article:published_time",
    "datePublished",
    "date",
    "pubdate",
    "publishdate",
  ]);
  const timeDate = html.match(/<time[^>]+datetime=["']([^"']+)["']/i)?.[1] ?? null;
  const visiblePublishedDate = html.match(
    /class=["'][^"']*\bcreated\b[^"']*["'][^>]*>\s*(\d{4}-\d{2}-\d{2})\s*<\/[^>]+>[\s\S]{0,160}?發表/i,
  )?.[1] ?? null;
  const publishedAt = validIso(jsonLdDate) ??
    validIso(metaDate) ??
    validIso(timeDate) ??
    validIso(visiblePublishedDate);
  const publishedAtMethod = validIso(jsonLdDate)
    ? "jsonld-datePublished"
    : validIso(metaDate)
      ? "meta-published-time"
      : validIso(timeDate)
        ? "time-datetime"
        : validIso(visiblePublishedDate)
          ? "visible-created-date-with-published-label"
          : null;

  return {
    title: resolvedTitle?.trim() || null,
    publishedAt,
    publishedAtMethod,
  };
}

export function normalizeComparableTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/\s[-–—|｜]\s[^-–—|｜]{1,40}$/u, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

export function titleSimilarity(left: string, right: string) {
  const a = normalizeComparableTitle(left);
  const b = normalizeComparableTitle(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Number((Math.min(a.length, b.length) / Math.max(a.length, b.length)).toFixed(4));
  }

  const bigrams = (value: string) => {
    const output = new Set<string>();
    for (let index = 0; index < value.length - 1; index += 1) {
      output.add(value.slice(index, index + 2));
    }
    return output;
  };
  const leftPairs = bigrams(a);
  const rightPairs = bigrams(b);
  const overlap = [...leftPairs].filter((value) => rightPairs.has(value)).length;
  return Number(
    ((2 * overlap) / Math.max(leftPairs.size + rightPairs.size, 1)).toFixed(4),
  );
}

export function buildWaybackCdxUrl(originalUrl: string) {
  const params = new URLSearchParams({
    url: originalUrl,
    output: "json",
    filter: "statuscode:200",
    fl: "timestamp,original,statuscode",
    limit: "1",
    from: "1996",
  });
  return `https://web.archive.org/cdx/search/cdx?${params.toString()}`;
}

export function parseWaybackFirstCapture(
  payload: unknown,
  expectedUrl: string,
): WaybackCapture | null {
  if (!Array.isArray(payload) || payload.length < 2) return null;
  const header = payload[0];
  if (!Array.isArray(header)) return null;
  const timestampIndex = header.indexOf("timestamp");
  const originalIndex = header.indexOf("original");
  const statusIndex = header.indexOf("statuscode");
  if (timestampIndex < 0 || originalIndex < 0 || statusIndex < 0) return null;

  const expected = new URL(expectedUrl);
  for (const rawRow of payload.slice(1)) {
    if (!Array.isArray(rawRow)) continue;
    const timestamp = String(rawRow[timestampIndex] ?? "");
    const originalUrl = String(rawRow[originalIndex] ?? "");
    const statusCode = String(rawRow[statusIndex] ?? "");
    if (!/^\d{14}$/.test(timestamp) || statusCode !== "200") continue;
    let original: URL;
    try {
      original = new URL(originalUrl);
    } catch {
      continue;
    }
    if (
      original.hostname.toLowerCase() !== expected.hostname.toLowerCase() ||
      original.pathname.replace(/\/$/, "") !== expected.pathname.replace(/\/$/, "")
    ) {
      continue;
    }
    const capturedAt = validIso(
      `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T` +
        `${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`,
    );
    if (!capturedAt) continue;
    return { timestamp, capturedAt, originalUrl, statusCode };
  }
  return null;
}

export function buildWaybackSnapshotUrl(capture: WaybackCapture) {
  return `https://web.archive.org/web/${capture.timestamp}id_/${capture.originalUrl}`;
}
