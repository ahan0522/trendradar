import Link from "next/link";

const workflow = [
  "全球資訊流",
  "主題辨識",
  "投資性篩選",
  "訊號偵測",
  "投資假設",
  "受惠公司映射",
  "績效回測",
  "訊號資料庫",
];

const caseStudies = [
  "Memory Supercycle",
  "AI Power Infrastructure",
  "AI Cooling Infrastructure",
  "CoWoS Capacity",
  "Nuclear / Grid Infrastructure",
];

const differences = [
  {
    label: "新聞網站",
    text: "告訴你今天發生了什麼。",
  },
  {
    label: "ChatGPT",
    text: "幫你整理與摘要資訊。",
  },
  {
    label: "TrendRadar",
    text: "追蹤一個市場訊號是否能變成可驗證的研究案例。",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.24),_transparent_34%),#090b13] p-6 shadow-2xl shadow-sky-950/30 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">AI 驅動市場研究平台</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
                在市場形成共識之前，發現值得研究的市場訊號。
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300">
                TrendRadar 不是另一個 AI 新聞摘要工具。它把全球資訊流轉換成可驗證的市場訊號，並把每個訊號的投資假設、觀察名單、時間線、回測、結果與教訓累積到 Signal Ledger。
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/signals" className="rounded-full bg-white px-6 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100">
                  查看市場訊號
                </Link>
                <Link href="/market-map" className="rounded-full border border-zinc-700 bg-zinc-950 px-6 py-3 text-sm font-bold text-zinc-200 transition hover:border-sky-400/60">
                  查看市場地圖
                </Link>
                <Link href="/reports/signal-validation" className="rounded-full border border-zinc-700 bg-zinc-950 px-6 py-3 text-sm font-bold text-zinc-200 transition hover:border-sky-400/60">
                  查看驗證報告
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">核心護城河</p>
              <h2 className="mt-3 text-2xl font-black">Signal Ledger：市場訊號資料庫</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                AI 只是協助整理資訊的工具。真正長期累積的資產，是一套可以回溯、驗證、修正的市場訊號資料庫。
              </p>
              <div className="mt-5 grid gap-2">
                {["訊號", "投資假設", "觀察名單", "時間線", "回測", "結果", "教訓"].map((item) => (
                  <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm font-bold text-zinc-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {differences.map((item) => (
            <div key={item.label} className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
              <p className="mt-3 text-lg font-black leading-7 text-white">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">研究流程</p>
              <h2 className="mt-2 text-2xl font-black">從資訊流到可驗證的市場訊號</h2>
            </div>
            <p className="text-sm text-zinc-600">每一步都應該可以檢查，而不是黑箱 AI 回答。</p>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {workflow.map((item, index) => (
              <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-mono text-xs font-black text-sky-300">0{index + 1}</p>
                <p className="mt-3 font-black text-white">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">第一個聚焦市場</p>
            <h2 className="mt-2 text-2xl font-black">AI 基礎建設</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              第一階段聚焦 HBM、DRAM、NAND、CoWoS、散熱、電力、電網與網通。這些領域資訊較公開，也比較容易建立可驗證的歷史案例。
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">最小可驗證產品</p>
            <h2 className="mt-2 text-2xl font-black">5 個完整歷史案例</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {caseStudies.map((item) => (
                <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 font-bold text-zinc-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Signal Ledger",
              text: "查看每個市場訊號的假設、強度、觀察名單與驗證結果。",
              href: "/signals",
            },
            {
              title: "Market Map",
              text: "把訊號放回 AI 基礎建設供應鏈，快速看出瓶頸集中在哪。",
              href: "/market-map",
            },
            {
              title: "Failed Signals",
              text: "保存失敗、部分成立與待驗證案例，讓研究流程能持續修正。",
              href: "/failed-signals",
            },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="group rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6 transition hover:border-sky-400/50">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">{item.title}</p>
              <p className="mt-3 text-lg font-black leading-7 text-white">{item.text}</p>
              <p className="mt-5 text-sm font-bold text-sky-300 transition group-hover:translate-x-1">進入頁面 →</p>
            </Link>
          ))}
        </section>

        <section className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">產品原則</p>
          <h2 className="mt-2 text-2xl font-black text-white">先有證據，再談自動化。</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-amber-100/80">
            下一個里程碑不是更多資料源或更多 AI 功能，而是建立完整案例：TrendRadar 當時看到了什麼、形成什麼假設、後來結果如何。
          </p>
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">研究聲明</p>
          <h2 className="mt-2 text-2xl font-black">這不是投資建議。</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-zinc-400">
            TrendRadar 只協助辨識值得研究的市場訊號，並透過時間驗證它是否成立。這不是買賣建議，也不提供目標價。每個訊號都可能錯誤、不完整，或出現得太早。
          </p>
        </section>
      </div>
    </main>
  );
}
