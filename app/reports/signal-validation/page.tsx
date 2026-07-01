import Link from "next/link";
import { getPublicationFeed } from "@/lib/signals/publication-feed";
import type {
  SignalPublicationFeedItem,
} from "@/types/signals";

function monthLabel(periodKey: string) {
  const [year, month] = periodKey.split("-");
  return `${year} 年 ${Number(month)} 月`;
}

async function loadMonthlyPublications() {
  try {
    return {
      data: await getPublicationFeed({ period: "monthly" }),
      error: "",
    };
  } catch (cause) {
    return {
      data: { period: "monthly" as const, itemCount: 0, periods: [] },
      error: cause instanceof Error ? cause.message : "無法讀取公開報告",
    };
  }
}

export const dynamic = "force-dynamic";

export default async function SignalValidationReportPage() {
  const { data, error } = await loadMonthlyPublications();

  return (
    <main className="min-h-screen bg-[#07090d] px-4 py-6 text-zinc-100 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-zinc-800 pb-8 md:pb-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="text-sm font-black tracking-tight text-white">
              TrendRadar
            </Link>
            <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-bold text-zinc-400">
              公開研究報告
            </span>
          </div>
          <p className="mt-12 text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">
            Market Signal Research
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
            每月值得持續研究的市場方向
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-400 md:text-lg">
            TrendRadar 從市場資訊中尋找訊號，建立研究假設與觀察標的，並在後續留下驗證結果。只展示通過內部審核且正式發布的內容。
          </p>
        </header>

        {error ? <ErrorState message={error} /> : null}
        {!error && data.itemCount === 0 ? <EmptyState /> : null}

        {data.periods.map((period) => (
          <section key={period.periodKey} className="border-b border-zinc-800 py-10 md:py-14">
            <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-zinc-600">Monthly Research</p>
                <h2 className="mt-2 text-2xl font-black">{monthLabel(period.periodKey)}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-500">
                  {period.items.length} 個通過發布閘門的研究方向
                </p>
              </div>
              <div className="space-y-6">
                {period.items.map((item, index) => (
                  <PublicationArticle key={item.reviewId} item={item} rank={index + 1} />
                ))}
              </div>
            </div>
          </section>
        ))}

        <footer className="py-10 text-sm leading-7 text-zinc-600">
          TrendRadar 提供市場研究與追蹤方向，不構成投資建議。訊號可能成功、部分成立或失敗，所有結果都會保留。
        </footer>
      </div>
    </main>
  );
}

function PublicationArticle({ item, rank }: { item: SignalPublicationFeedItem; rank: number }) {
  const { brief } = item;
  return (
    <article className="overflow-hidden rounded-lg border border-zinc-800 bg-[#0d1016]">
      <div className="grid md:grid-cols-[84px_1fr]">
        <div className="border-b border-zinc-800 p-5 md:border-b-0 md:border-r">
          <span className="font-mono text-2xl font-black text-cyan-300">{String(rank).padStart(2, "0")}</span>
        </div>
        <div className="p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-emerald-300">已發布</span>
            <span className="text-zinc-600">{brief.asOfDate}</span>
            <span className="text-zinc-600">研究品質 {item.qualityScore}</span>
          </div>
          <h3 className="mt-4 text-2xl font-black leading-tight md:text-3xl">{brief.headline}</h3>
          <p className="mt-4 text-base leading-8 text-zinc-300">{brief.whyItMatters}</p>

          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            <BriefBlock title="為何值得注意">
              <p>{brief.evidenceSummary}</p>
            </BriefBlock>
            <BriefBlock title="目前驗證狀態">
              <p>{brief.validationSummary}</p>
            </BriefBlock>
          </div>

          {brief.attentionDirections.length > 0 ? (
            <div className="mt-7">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">注意標的</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {brief.attentionDirections.map((direction) => (
                  <div key={`${direction.market}-${direction.symbol}`} className="rounded-md border border-zinc-800 bg-black/20 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <strong>{direction.companyName}</strong>
                      <span className="font-mono text-xs text-cyan-300">{direction.market} · {direction.symbol}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">{direction.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            <BulletBlock title="後續追蹤" items={brief.trackingIndicators} tone="text-cyan-300" />
            <BulletBlock title="假設失效條件" items={brief.invalidationConditions} tone="text-rose-300" />
          </div>
        </div>
      </div>
    </article>
  );
}

function BriefBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{title}</h4>
      <div className="mt-2 text-sm leading-7 text-zinc-400">{children}</div>
    </div>
  );
}

function BulletBlock({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">{title}</h4>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
          {items.map((item) => (
            <li key={item} className="flex gap-3">
              <span className={tone}>—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-zinc-600">尚待補充。</p>
      )}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="my-10 rounded-lg border border-rose-400/20 bg-rose-400/5 p-6">
      <h2 className="font-black text-rose-200">報告暫時無法讀取</h2>
      <p className="mt-2 text-sm leading-6 text-rose-100/60">{message}</p>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/5 font-mono font-black text-cyan-300">
          0
        </span>
        <h2 className="mt-6 text-3xl font-black">第一份公開報告仍在驗證中</h2>
        <p className="mt-4 text-base leading-8 text-zinc-500">
          目前 Signal 仍在內部檢查證據品質、標的因果關係與後續績效。未通過發布閘門前，不會用候選資料填滿頁面。
        </p>
        <Link href="/signals" className="mt-7 inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm font-black text-zinc-300 transition hover:border-cyan-300/50 hover:text-white">
          查看內部訊號研究狀態
        </Link>
      </div>
    </section>
  );
}
