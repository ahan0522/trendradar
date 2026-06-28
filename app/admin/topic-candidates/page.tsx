import Link from "next/link";
import {
  getDiscoveryArticles,
  getRecentDiscoveryArticles,
} from "@/lib/discovery/candidate-feed";
import {
  discoverCandidateTopics,
  enrichCandidateTopicsWithHistory,
  type CandidateTopic,
} from "@/lib/topic-candidates";
import { groupArticlesToHomepageTopics } from "@/lib/topic-grouping";
import type { HomepageTopicCard } from "@/types/topic";

type AdminTopicCandidatesPageProps = {
  searchParams: Promise<{
    secret?: string;
    limit?: string;
  }>;
};

function isAuthorized(secret?: string) {
  const token = process.env.CRON_SECRET;

  if (!token) {
    return process.env.NODE_ENV !== "production";
  }

  return secret === token;
}

function formatRelativeTime(dateString: string | null) {
  if (!dateString) return "時間未知";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "時間未知";

  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 1000 / 60);

  if (diffMinutes < 1) return "剛剛";
  if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;

  return `${Math.floor(diffHours / 24)} 天前`;
}

function getCandidateQuality(topic: CandidateTopic) {
  if (topic.publishable) return "可上首頁";
  if (topic.qualityScore >= 55) return "需觀察";
  return "偏雜訊";
}

function MetricPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
      {children}
    </span>
  );
}

function RuleTopicCard({ topic }: { topic: HomepageTopicCard }) {
  return (
    <Link
      href={`/topics/${topic.slug}`}
      className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-blue-700">正式規則主題</div>
          <h3 className="mt-1 text-xl font-bold text-slate-950">{topic.title}</h3>
        </div>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          {topic.category}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <MetricPill>熱度 {topic.heatScore}</MetricPill>
        <MetricPill>{topic.sourceCount} 家媒體</MetricPill>
        <MetricPill>{topic.articleCount} 篇文章</MetricPill>
        <MetricPill>{formatRelativeTime(topic.updatedAt)}</MetricPill>
      </div>
    </Link>
  );
}

function CandidateCard({ topic }: { topic: CandidateTopic }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-emerald-700">
            自動候選主題
          </div>
          <h3 className="mt-1 text-xl font-bold text-slate-950">{topic.title}</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          {getCandidateQuality(topic)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <MetricPill>{topic.category}</MetricPill>
        <MetricPill>熱度 {topic.heatScore}</MetricPill>
        <MetricPill>{topic.heatStateLabel}</MetricPill>
        <MetricPill>持續分數 {topic.persistenceScore}</MetricPill>
        <MetricPill>活躍 {topic.activeDays} 天</MetricPill>
        <MetricPill>品質 {topic.qualityScore}</MetricPill>
        <MetricPill>{topic.sourceCount} 家有效來源</MetricPill>
        <MetricPill>{topic.rawSourceCount} 個原始來源</MetricPill>
        <MetricPill>{topic.articleCount} 篇文章</MetricPill>
        <MetricPill>{formatRelativeTime(topic.latestPublishedAt)}</MetricPill>
      </div>

      <p className="mt-4 rounded-xl bg-emerald-50/70 p-3 text-sm leading-6 text-slate-700">
        {topic.summary}
      </p>
      <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm leading-6 text-sky-900">
        <span className="font-bold">{topic.heatStateLabel}：</span>
        {topic.heatReason}
      </p>

      {!topic.publishable && topic.rejectionReasons.length > 0 && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <div className="text-xs font-semibold text-amber-700">
            暫不自動上首頁原因
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {topic.rejectionReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <div className="text-xs font-semibold text-slate-500">候選關鍵字</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {topic.keywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <div className="text-xs font-semibold text-slate-500">樣本文章</div>
        {topic.articles.slice(0, 5).map((article) => (
          <a
            key={article.id}
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700 hover:bg-slate-100"
          >
            <span className="font-medium text-slate-950">{article.title}</span>
            <span className="mt-1 block text-xs text-slate-500">
              {article.sourceName} / {article.category} /{" "}
              {formatRelativeTime(article.publishedAt)}
            </span>
          </a>
        ))}
      </div>
    </article>
  );
}

export default async function AdminTopicCandidatesPage({
  searchParams,
}: AdminTopicCandidatesPageProps) {
  const params = await searchParams;

  if (!isAuthorized(params.secret)) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 md:p-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8">
          <h1 className="text-2xl font-bold text-slate-950">需要授權</h1>
          <p className="mt-3 leading-7 text-slate-600">
            這是內部主題分群檢視頁。請在網址加上
            <span className="font-mono"> ?secret=CRON_SECRET</span>。
          </p>
        </div>
      </main>
    );
  }

  const limit = Number(params.limit ?? 240);
  const historicalItems = await getDiscoveryArticles(Math.max(limit, 3000));
  const newsItems = getRecentDiscoveryArticles(historicalItems, 7, limit);

  const articles = newsItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    sourceName: item.sourceName,
    category: item.category,
    sourcePool: item.sourcePool,
    sourceKind: item.sourceKind,
    sourceTier: item.sourceTier,
    sourceWeight: item.sourceWeight,
    credibilityWeight: item.credibilityWeight,
    sourceRole: item.sourceRole,
    link: item.link,
    publishedAt: item.publishedAt,
  }));

  const ruleTopics = groupArticlesToHomepageTopics(articles).slice(0, 6);
  const candidateTopics = enrichCandidateTopicsWithHistory(
    discoverCandidateTopics(articles, {
      maxTopics: 6,
      minArticles: 2,
    }),
    historicalItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      sourceName: item.sourceName,
      category: item.category,
      sourcePool: item.sourcePool,
      sourceKind: item.sourceKind,
      sourceTier: item.sourceTier,
      sourceWeight: item.sourceWeight,
      credibilityWeight: item.credibilityWeight,
      sourceRole: item.sourceRole,
      link: item.link,
      publishedAt: item.publishedAt,
    })),
  );

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              返回首頁
            </Link>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              主題候選檢視
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              左側是目前 rule-based 主題，右側是同一批 RSS 文章跑出的自動候選分群。這頁只做觀察，不寫入 DB。
            </p>
          </div>

          <div className="rounded-full bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            RSS 樣本 {newsItems.length} 篇
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-950">
                目前正式規則
              </h2>
              <span className="text-sm text-slate-500">
                {ruleTopics.length} 個
              </span>
            </div>

            <div className="space-y-4">
              {ruleTopics.length > 0 ? (
                ruleTopics.map((topic) => (
                  <RuleTopicCard key={topic.id} topic={topic} />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  目前沒有命中正式規則。
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-950">
                自動候選分群
              </h2>
              <span className="text-sm text-slate-500">
                {candidateTopics.length} 個
              </span>
            </div>

            <div className="space-y-4">
              {candidateTopics.length > 0 ? (
                candidateTopics.map((topic) => (
                  <CandidateCard key={topic.id} topic={topic} />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  目前沒有找到候選分群。
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
