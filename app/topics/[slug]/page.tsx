import Link from "next/link";
import { headers } from "next/headers";

type TopicArticle = {
  id: string;
  title: string;
  description: string;
  quickSummary?: string;
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
  ruleKey?: string;
  keywords?: string[];
  discoveryMode?: string;
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

function getTopSources(articles: TopicArticle[]) {
  const sourceCounts = new Map<string, number>();

  articles.forEach((article) => {
    const sourceName = article.sourceName || "未知來源";
    sourceCounts.set(sourceName, (sourceCounts.get(sourceName) ?? 0) + 1);
  });

  return Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
}

function formatDiscoveryMode(mode?: string) {
  if (mode === "rule_based") return "規則分群";
  if (mode === "candidate_cluster") return "自動候選分群";
  if (mode === "ai_discovered") return "AI 自動發現";
  return mode || "規則分群";
}

async function getTopic(slug: string): Promise<TopicDetail | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) return null;

  const res = await fetch(
    `${protocol}://${host}/api/topics/db/${encodeURIComponent(slug)}`,
    {
      cache: "no-store",
    }
  );

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
      <main className="min-h-screen bg-slate-50 p-6 md:p-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
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

  const topSources = getTopSources(topic.articles);
  const keywords = topic.keywords?.length ? topic.keywords : topic.tags;

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800"
        >
          返回首頁
        </Link>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative">
            <img
              src={topic.heroImageUrl}
              alt={topic.title}
              className="h-72 w-full object-cover md:h-96"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white md:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">
                  {topic.category}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                  {formatDiscoveryMode(topic.discoveryMode)}
                </span>
              </div>

              <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
                {topic.longTitle}
              </h1>
            </div>
          </div>

          <div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">熱度</div>
              <div className="mt-1 text-2xl font-bold text-slate-950">
                {topic.heatScore}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">媒體覆蓋</div>
              <div className="mt-1 text-2xl font-bold text-slate-950">
                {topic.sourceCount} 家
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">來源文章</div>
              <div className="mt-1 text-2xl font-bold text-slate-950">
                {topic.articleCount} 篇
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">最後更新</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">
                {formatRelativeTime(topic.updatedAt)}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-blue-700">
                    主題摘要
                  </div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    這個主題現在發生什麼事
                  </h2>
                </div>
              </div>
              <p className="mt-4 text-lg leading-8 text-slate-700">
                {topic.summary || "目前尚未產生摘要，系統會在下一次同步時補上。"}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {(topic.tags.length ? topic.tags : [topic.category]).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-blue-50 px-3 py-1.5 text-sm text-blue-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-semibold text-blue-700">重點整理</div>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                可以先看的幾個重點
              </h2>

              {topic.bullets.length > 0 ? (
                <div className="mt-5 grid gap-3">
                  {topic.bullets.map((item, index) => (
                    <div
                      key={item}
                      className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[40px_minmax(0,1fr)]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <p className="leading-7 text-slate-700">{item}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  目前還沒有重點整理。
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-semibold text-blue-700">主題脈絡</div>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                目前可拆出的子主題
              </h2>

              <div className="mt-5 flex flex-wrap gap-2">
                {(topic.subtopics.length
                  ? topic.subtopics
                  : ["尚未拆分子主題"]
                ).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-blue-700">來源文章</div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    不用點開也能快速看懂
                  </h2>
                </div>
                <div className="text-sm text-slate-500">
                  已合併相似來源，共 {topic.articles.length} 則
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {topic.articles.map((article) => (
                  <a
                    key={article.id}
                    href={article.link}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`查看原文：${article.title}`}
                    className="block rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="rounded-xl bg-blue-50/60 p-4">
                      <div className="text-xs font-semibold text-blue-700">
                        重點快讀
                      </div>
                      <p className="mt-1 text-base leading-7 text-slate-800">
                        {article.quickSummary ||
                          article.description ||
                          "目前只有原始來源，系統會在下一次同步時補上重點整理。"}
                      </p>
                    </div>

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
                        <span>{formatRelativeTime(article.publishedAt)}</span>
                      )}
                      <span className="font-medium text-slate-700">
                        查看原文 →
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-semibold text-blue-700">主題抓取</div>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                這張卡如何被建立
              </h2>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xs font-medium text-slate-500">發現模式</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {formatDiscoveryMode(topic.discoveryMode)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">規則 ID</div>
                  <div className="mt-1 font-mono text-sm text-slate-700">
                    {topic.ruleKey || topic.slug}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">命中訊號</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {keywords.slice(0, 10).map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-semibold text-blue-700">媒體分布</div>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                主要來源
              </h2>

              <div className="mt-5 space-y-3">
                {topSources.map(([sourceName, count]) => (
                  <div
                    key={sourceName}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {sourceName}
                    </span>
                    <span className="text-sm text-slate-500">{count} 篇</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
