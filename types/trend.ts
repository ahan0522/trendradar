export type TrendCategory =
  | "國際"
  | "台海"
  | "新聞"
  | "政治"
  | "生活"
  | "體育"
  | "科技"
  | "3C"
  | "遊戲"
  | "旅遊"
  | "動漫"
  | "文化"
  | "娛樂"
  | "財經"
  | "AI";

export type TrendTopic = {
  id: string;
  title: string;
  category: TrendCategory;
  region: string;
  score: number;
  velocity: number;
  sentiment: string;
  updatedAt: string;
  sources: string[];
  summary: string;
  bullets: string[];
  metrics: {
    searchScore: number;
    newsScore: number;
    socialScore: number;
    engagementScore: number;
    velocityScore: number;
    diversityScore: number;
  };
};
