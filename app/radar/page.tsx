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

export const dynamic = "force-dynamic";

const stateStyle: Record<CandidateTopic["heatState"], string> = {
  sustained_high: "border-rose-300/30 bg-rose-400/10 text-rose-200",
  breaking_out: "border-orange-300/30 bg-orange-400/10 text-orange-200",
  rising: "border-sky-300/30 bg-sky-400/10 text-sky-200",
  cooling: "border-zinc-600 bg-zinc-800 text-zinc-300",
  emerging: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-900/80 p-3">
      <p className="text-xs text-zinc-600">{label}</p>
      <p className="mt-1 font-mono text-sm font-black text-zinc-200">{value}</p>
    </div>
  );
}

function CandidateCard({ topic }: { topic: CandidateTopic }) {
  return (
    <article className="rounded-3xl border border-zinc-800 bg-zinc-950/85 p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            {topic.category} · 候選主題
          </p>
          <h2 className="mt-2 text-xl font-black leading-snug text-white">
            {topic.title}
          </h2>
        </div>
        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-black ${stateStyle[topic.heatState]}`}
        >
          {topic.heatStateLabel}
        </span>
      </div>

      <p className="mt-4 text-sm leading-7 text-zinc-400">{topic.heatReason}</p>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="24 小時" value={`${topic.articleCount24h} 篇`} />
        <Metric label="7 天" value={`${topic.articleCount7d} 篇`} />
        <Metric label="活躍天數" value={`${topic.activeDays} 天`} />
        <Metric label="有效來源" value={`${topic.sourceCount} 個`} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {topic.keywords.slice(0, 6).map((keyword) => (
          <span
            key={keyword}
            className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400"
          >
            {keyword}
          </span>
        ))}
      </div>

      <p className="mt-5 border-t border-zinc-800 pt-4 text-xs leading-6 text-zinc-600">
        這是全市場自動偵測候選，不代表正式投資訊號。通過多重證據與可投資性檢查後，才會進入 Signal Ledger。
      </p>
    </article>
  );
}

function isMarketResearchCandidate(topic: CandidateTopic) {
  if (
    ["體育", "文化", "娛樂", "遊戲", "動漫", "旅遊", "社會"].includes(
      topic.category,
    )
  ) {
    return false;
  }
  if (
    /開獎|彩券|便當股|可追|買進|進場|外資|投信|法人|槓桿|台股跌|漲停|目標價|ETF|換股|成分股|刪除台積電|納入鴻海|金曲|職棒|球賽|世足|淘汰賽|病況|停班課|紅色警戒|飛機撞/i.test(
      topic.title,
    )
  ) {
    return false;
  }
  const researchText = `${topic.title} ${topic.keywords.join(" ")}`;
  const hasMarketResearchContext =
    /AI|人工智慧|半導體|晶片|伺服器|記憶體|HBM|CPO|封裝|散熱|電力|電網|能源|石油|天然氣|原物料|關稅|貿易|供應鏈|產能|訂單|央行|利率|通膨|金融|政策|法規|台海|美中|俄烏|中東|伊朗|國防|軍工|基礎建設/i.test(
      researchText,
    );
  const isResearchCategory = ["AI", "科技", "財經"].includes(topic.category);

  return (
    (hasMarketResearchContext || isResearchCategory) &&
    (topic.qualityScore >= 50 || topic.heatState !== "emerging")
  );
}

export default async function RadarPage() {
  const historicalArticles = await getDiscoveryArticles(3000);
  const recentArticles = getRecentDiscoveryArticles(historicalArticles, 7, 900);
  const candidates = enrichCandidateTopicsWithHistory(
    discoverCandidateTopics(recentArticles, {
      maxTopics: 24,
      minArticles: 2,
    }),
    historicalArticles,
  )
    .filter(isMarketResearchCandidate)
    .slice(0, 12);
  const sustainedCount = candidates.filter(
    (item) => item.heatState === "sustained_high",
  ).length;
  const acceleratingCount = candidates.filter(
    (item) =>
      item.heatState === "breaking_out" || item.heatState === "rising",
  ).length;

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-10 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 md:p-10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-300">
            Market Discovery Engine
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
            全市場雷達
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 md:text-lg">
            掃描近 30 天新聞，辨識短期爆發、持續升溫與持續高熱度。熱門度只負責發現，通過研究與證據檢查後才會成為正式 Signal。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <span className="rounded-full bg-rose-400/10 px-4 py-2 text-sm font-bold text-rose-200">
              持續高熱度 {sustainedCount}
            </span>
            <span className="rounded-full bg-sky-400/10 px-4 py-2 text-sm font-bold text-sky-200">
              升溫中 {acceleratingCount}
            </span>
            <span className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-400">
              30 天樣本 {historicalArticles.length} 篇
            </span>
            <Link
              href="/signals"
              className="rounded-full bg-white px-4 py-2 text-sm font-black text-zinc-950"
            >
              查看正式市場訊號
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          {candidates.map((topic) => (
            <CandidateCard key={topic.slug} topic={topic} />
          ))}
        </section>

        {candidates.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-zinc-700 p-10 text-center text-zinc-500">
            目前沒有形成可辨識群組的全市場候選。
          </div>
        ) : null}
      </div>
    </main>
  );
}
