export type TopicCategory = "AI" | "體育" | "3C" | "國際" | "財經" | "娛樂";

export type HomepageTopicCard = {
  id: string;
  slug: string;
  title: string;
  category: TopicCategory | string;
  heroImageUrl: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
};

export type TopicArticle = {
  id: string;
  title: string;
  sourceName: string;
  link: string;
  publishedAt: string | null;
};

export type TopicDetail = {
  id: string;
  slug: string;
  title: string;
  longTitle: string;
  category: TopicCategory | string;
  heroImageUrl: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
  summary: string;
  bullets: string[];
  subtopics: string[];
  tags: string[];
  articles: TopicArticle[];
};