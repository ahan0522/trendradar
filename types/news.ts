import type { TrendCategory } from "@/types/trend";

export type NewsSource = {
  id: string;
  name: string;
  category: TrendCategory;
  region: string;
  url: string;
  enabled: boolean;
};

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  sourceId: string;
  sourceName: string;
  category: TrendCategory;
  region: string;
  publishedAt: string | null;
  description: string;
};
