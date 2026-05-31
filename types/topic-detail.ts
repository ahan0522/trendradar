import type { NewsItem } from "@/types/news";
import type { TrendTopic } from "@/types/trend";

export type TopicMetricPoint = {
  measuredAt: string;
  totalScore: number;
  velocityScore: number;
  newsScore: number;
};

export type TopicSourceStat = {
  sourceName: string;
  count: number;
};

export type TopicDetail = {
  topic: TrendTopic;
  relatedArticles: NewsItem[];
  sourceStats: TopicSourceStat[];
  metricsTimeline: TopicMetricPoint[];
  lastSyncedAt: string | null;
};
