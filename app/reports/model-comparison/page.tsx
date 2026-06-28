import Link from "next/link";
import { getLatestModelReplay, type ReplaySignal } from "@/lib/signals/model-replay";

export const dynamic = "force-dynamic";

const familyLabels: Record<string, string> = {
  memory: "記憶體",
  semiconductor: "半導體",
  "advanced-packaging": "先進封裝",
  "ai-compute": "AI 算力",
  "power-grid": "電力與電網",
  "defense-geopolitics": "國防與地緣風險",
  "energy-commodities": "能源與原物料",
  "biotech-health": "生技醫療",
  robotics: "機器人",
  "trade-tariffs": "關稅與貿易",
  "macro-rates": "利率與總經",
  "ev-battery": "電動車與電池",
  "optical-network": "光通訊與網路",
  other: "其他",
};

function familyLabel(value: string) {
  return familyLabels[value] ?? value;
}

function percentage(value: unknown) {
  return `${(Number(value ?? 0) * 100).toFixed(0)}%`;
}

export default async function ModelComparisonPage() {
  let report: Awaited<ReturnType<typeof getLatestModelReplay>> = null;
  let error: string | null = null;
  try {
    report = await getLatestModelReplay();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "讀取模型比較失敗";
  }

  if (!report) {
    return (
      <main className="min-h-screen bg-[#05070d] px-4 py-10 text-white md:px-8">
        <div className="mx-auto max-w-5xl rounded-3xl border border-amber-300/20 bg-amber-400/5 p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300">Model Replay</p>
          <h1 className="mt-3 text-3xl font-black">尚未建立模型比較結果</h1>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            {error ?? "先執行歷史重播後，這裡會顯示固定規則與全市場 Discovery 的逐月比較。"}
          </p>
          <Link href="/signals/monthly" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-zinc-950">
            返回月度訊號
          </Link>
        </div>
      </main>
    );
  }

  const summary = report.summary as {
    monthCount?: number;
    baselineSignalCount?: number;
    candidateSignalCount?: number;
    averageFamilyOverlapRate?: number;
    averageBaselineDiversity?: number;
    averageCandidateDiversity?: number;
    averageBaselineFamilyCount?: number;
    averageCandidateFamilyCount?: number;
    coverageBreadthLift?: number;
    newlyDiscoveredFamilies?: string[];
    monthsWithNewFamilies?: number;
  };

  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.2),_transparent_35%),#090b13] p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-sky-300">Historical Model Replay</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">新版真的找到更多市場方向嗎？</h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-zinc-400">
            將舊版固定研究規則與新版全市場 Discovery 放在相同 asOfDate 重播。此頁先比較主題覆蓋、來源與多元度；績效優劣必須等平行觀察籃子完成回測後才下結論。
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2">基準：{report.baselineModelVersion}</span>
            <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-2 text-sky-200">候選：{report.candidateModelVersion}</span>
            <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-2">{report.startMonth} → {report.endMonth}</span>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          <Metric label="比較月份" value={String(summary.monthCount ?? 0)} />
          <Metric label="舊版訊號" value={String(summary.baselineSignalCount ?? 0)} />
          <Metric label="新版候選" value={String(summary.candidateSignalCount ?? 0)} />
          <Metric label="發現新領域月份" value={String(summary.monthsWithNewFamilies ?? 0)} tone="text-emerald-300" />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Coverage</p>
            <h2 className="mt-2 text-2xl font-black">覆蓋改善</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <SmallMetric label="平均重疊率" value={percentage(summary.averageFamilyOverlapRate)} />
              <SmallMetric label="舊版每月領域" value={Number(summary.averageBaselineFamilyCount ?? 0).toFixed(1)} />
              <SmallMetric label="新版每月領域" value={Number(summary.averageCandidateFamilyCount ?? 0).toFixed(1)} />
            </div>
            <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-400/5 p-4">
              <p className="text-xs font-bold text-zinc-500">每月研究覆蓋增幅</p>
              <p className="mt-1 font-mono text-3xl font-black text-sky-300">{percentage(summary.coverageBreadthLift)}</p>
            </div>
            <p className="mt-4 text-sm leading-7 text-zinc-400">覆蓋變廣不等於績效變好；真正有效性仍需平行觀察籃子與回測驗證。</p>
          </div>
          <div className="rounded-3xl border border-emerald-300/20 bg-emerald-400/5 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">New Coverage</p>
            <h2 className="mt-2 text-2xl font-black">新版額外發現的領域</h2>
            <div className="mt-5 flex flex-wrap gap-2">
              {(summary.newlyDiscoveredFamilies ?? []).map((family) => (
                <span key={family} className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-100">
                  {familyLabel(family)}
                </span>
              ))}
            </div>
            <p className="mt-5 text-sm leading-7 text-zinc-400">
              這些是研究覆蓋新增，不是績效勝利。下一步會對平行候選補受惠標的與價格，才能比較誰真正更有研究價值。
            </p>
          </div>
        </section>

        <section className="space-y-4">
          {report.months.map((row) => (
            <article key={row.month} className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-mono text-sm font-black text-sky-300">{row.month}</p>
                  <h2 className="mt-1 text-2xl font-black">站在 {row.asOfDate} 的模型比較</h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-zinc-900 px-3 py-2">重疊 {percentage(row.metrics.familyOverlapRate)}</span>
                  <span className="rounded-full bg-emerald-400/10 px-3 py-2 text-emerald-200">新增 {row.metrics.newlyDiscoveredFamilies.length} 類</span>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <SignalColumn title="舊版固定規則" signals={row.baselineSignals} />
                <SignalColumn title="新版全市場 Discovery" signals={row.candidateSignals} candidate />
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
      <p className="text-xs font-bold text-zinc-500">{label}</p>
      <p className="mt-2 font-mono text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function SignalColumn({ title, signals, candidate = false }: { title: string; signals: ReplaySignal[]; candidate?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${candidate ? "border-sky-300/20 bg-sky-400/5" : "border-zinc-800 bg-zinc-900/50"}`}>
      <p className={`text-xs font-bold uppercase tracking-[0.18em] ${candidate ? "text-sky-300" : "text-zinc-500"}`}>{title}</p>
      <div className="mt-3 space-y-2">
        {signals.map((signal) => (
          <div key={signal.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
            <p className="font-bold text-white">{signal.topic}</p>
            <p className="mt-2 text-xs text-zinc-500">
              {familyLabel(signal.family)} · 強度 {signal.strength} · 信心 {signal.confidence} · {signal.sourceCount} 來源
            </p>
          </div>
        ))}
        {signals.length === 0 ? <p className="py-4 text-sm text-zinc-600">本月沒有達標訊號。</p> : null}
      </div>
    </div>
  );
}
