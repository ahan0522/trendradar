import type { TrendCategory } from "@/types/trend";

export type NewsSource = {
  id: string;
  name: string;
  category: TrendCategory;
  region: string;
  url: string;
  enabled: boolean;
  sourcePool?: SourcePool;
  sourceKind?: SourceKind;
  sourceTier?: SourceTier;
  sourceWeight?: number;
  credibilityWeight?: number;
  role?: SourceRole;
};

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  sourceId: string;
  sourceName: string;
  category: TrendCategory;
  region: string;
  sourcePool?: SourcePool;
  sourceKind?: SourceKind;
  sourceTier?: SourceTier;
  sourceWeight?: number;
  credibilityWeight?: number;
  sourceRole?: SourceRole;
  publishedAt: string | null;
  description: string;
};

export type SourcePool =
  | "social_discussion"
  | "news_media"
  | "search_platform_trend"
  | "forum_community"
  | "official_source";

export type SourceKind =
  | "mainstream_news"
  | "local_news"
  | "industry_media"
  | "social_platform"
  | "forum"
  | "search_trend"
  | "video_platform"
  | "official_announcement"
  | "aggregator";

export type SourceRole =
  | "volume_signal"
  | "fact_verification"
  | "search_intent"
  | "early_discussion"
  | "official_record";

export type SourceTier =
  | "primary_source"
  | "secondary_analysis"
  | "social_signal";
