export type HistoricalSourceManifestEntry = {
  articleId: string;
  originalUrl: string;
  resolutionMethod: "exact-title-source-search";
  resolvedAt: string;
};

export const historicalSourceManifest: HistoricalSourceManifestEntry[] = [
  {
    articleId: "historical-backfill-61ba17b063b09169abdeaf0b60d629f5e6a87fc9",
    originalUrl: "https://www.ithome.com.tw/news/171039",
    resolutionMethod: "exact-title-source-search",
    resolvedAt: "2026-07-05",
  },
  {
    articleId: "historical-backfill-f577823b9fd2cac69cb1843be93ce53a4cb35dac",
    originalUrl: "https://www.president.gov.tw/News/39436",
    resolutionMethod: "exact-title-source-search",
    resolvedAt: "2026-07-05",
  },
];
