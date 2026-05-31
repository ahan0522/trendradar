import Link from "next/link";
import { headers } from "next/headers";

type TopicArticle = {
  id: string;
  title: string;
  description: string;
  category: string;
  region: string;
  sourceId: string;
  sourceName: string;
  link: string;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type TopicDetail = {
  id: string;
  slug: string;
  title: string;
  longTitle: string;
  category: string;
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

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "時間未知";

  const now = new Date();

  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 1000 / 60);

  if (diffMinutes < 1) return "剛剛";
  if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

async function getTopic(slug: string): Promise<TopicDetail | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) return null;

  const res = await fetch(`${protocol}://${host}/api/topics/db/${slug}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();
  return data.topic ?? null;
}
type TopicPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TopicDetailPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const topic = await getTopic(slug);

  if (!topic) {
  return (
    <main className="min-h-screen bg-white p-6 md:p-10">
      <div className="mx-auto max-w-3xl rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <div className="text-2xl font-semibold text-slate-700">
          目前找不到這個主題
        </div>
        <p className="mt-3 text-sm text-slate-500">
          可能是今天沒有命中這個主題的新聞，或系統仍在整理最新資料。
        </p>

        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700"
        >
          返回首頁
        </Link>
      </div>
    </main>
  );
}

  return (
    <main className="min-h-screen bg-white p-6 md:p-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800"
        >
          ← 返回首頁
        </Link>

        <div className="relative">
  	<img
    	src={topic.heroImageUrl}
    	alt={topic.title}
    	className="h-80 w-full rounded-3xl object-cover"
  	/>
  <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-black/30 to-transparent" />
</div>

        <div className="mt-6">
  	<div className="mb-3">
    	<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      	{topic.category}
    	</span>
  	</div>

  	<h1 className="text-4xl font-bold">{topic.longTitle}</h1>

 	 <p className="mt-3 text-sm leading-7 text-slate-500">
    	系統已自動整合相近新聞，以下為主題摘要、重點整理與來源文章。
  	</p>
</div>

        <div className="mt-3 text-sm text-slate-500">
          熱度 {topic.heatScore} ｜ {topic.sourceCount} 家媒體 ｜{" "}
          {topic.articleCount} 篇文章 ｜ {formatRelativeTime(topic.updatedAt)}
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-semibold">AI 摘要</h2>
          <p className="mt-3 leading-8 text-slate-700">{topic.summary}</p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-semibold">重點整理</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
            {topic.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-semibold">相關標籤</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {topic.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-semibold">子主題</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {topic.subtopics.map((item) => (
              <span
                key={item}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700"
              >
                {item}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-semibold">來源文章</h2>

          <div className="mt-4 space-y-3">
            {topic.articles.map((article) => (
              <a
                key={article.id}
                href={article.link}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="text-base font-medium text-slate-900">
                  {article.title}
                </div>

                {article.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                    {article.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    {article.sourceName || "未知來源"}
                  </span>
                  {article.category && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                      {article.category}
                    </span>
                  )}
                  {article.region && (
                    <span className="rounded-full bg-slate-50 px-3 py-1">
                      {article.region}
                    </span>
                  )}
                  {article.publishedAt && (
                    <span>｜ {formatRelativeTime(article.publishedAt)}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
