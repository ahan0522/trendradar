import Link from "next/link";
import { HomeHeroSignal } from "@/components/HomeHeroSignal";

const marketLanes = [
  { name: "Memory", text: "HBM、DRAM、NAND 價格與產能重新分配。" },
  { name: "Packaging", text: "CoWoS、先進封裝、測試與設備鏈瓶頸。" },
  { name: "Power", text: "資料中心電力、變壓器、UPS 與電網需求。" },
  { name: "Cooling", text: "液冷、高密度機櫃與熱管理供應鏈。" },
  { name: "Networking", text: "交換器、光通訊、Ethernet 與資料中心互連。" },
  { name: "Company Actions", text: "財測、擴產、法說會、併購與供應協議。" },
];

const researchTrust = [
  {
    title: "Evidence",
    text: "每個訊號都要能說清楚：是新聞增加、價格異常、公司行動，還是供應鏈變化造成。",
  },
  {
    title: "Time Machine",
    text: "只允許用 as_of_date 當下已知資料形成結論，未來資料只能拿來驗證。",
  },
  {
    title: "Validation",
    text: "成功、部分成立、失敗都保留，讓 Signal Ledger 能持續修正，而不是只展示漂亮案例。",
  },
  {
    title: "Research Report",
    text: "重要訊號要能變成完整研究報告：假設、證據、觀察名單、時間線、回測與教訓。",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <HomeHeroSignal />

        <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500">Market Map</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">先看產業地圖，再看單一訊號。</h2>
            </div>
            <Link href="/market-map" className="rounded-full bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100">
              打開 Market Map
            </Link>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
            TrendRadar 不應該只是列出很多新聞，而是把訊號放回 AI 基礎建設供應鏈。使用者一眼就能知道：市場瓶頸現在集中在記憶體、封裝、散熱、電力，還是公司行動。
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {marketLanes.map((lane) => (
              <div key={lane.name} className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
                <p className="text-lg font-black text-white">{lane.name}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{lane.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500">Research Radar</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">不要給我全部，給我最值得研究的 1-3 個。</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              `/signals` 的定位會從資料表轉成研究入口：只推強度夠高、證據夠明確、能形成觀察名單的訊號。其他還不成熟的題目，先放觀察池。
            </p>
            <Link href="/signals" className="mt-6 inline-flex rounded-full border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-sky-400/60">
              查看 Research Radar
            </Link>
          </div>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950/90 p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-zinc-500">Latest Validation</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight">真正的產品不是 AI 摘要，而是可驗證紀錄。</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              每個訊號都要留下當時的假設、觀察名單與後續結果。使用者付費買的不是「今天 AI 怎麼說」，而是一套會累積、會犯錯、會修正的 Signal Ledger。
            </p>
            <Link href="/reports/signal-validation" className="mt-6 inline-flex rounded-full border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-bold text-zinc-200 transition hover:border-sky-400/60">
              查看驗證報告
            </Link>
          </div>
        </section>

        <section className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_34%),#090b13] p-6 md:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">Time Machine Simulation</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">站在當時，不偷看未來。</h2>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                TrendRadar 最有辨識度的功能，應該是證明每個研究判斷只用了當時可見資料。未來結果只能用來驗證，不能回頭污染訊號產生。
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
              <div className="grid gap-3 md:grid-cols-4">
                {["Signal Created", "Evidence Added", "Basket Tracked", "Outcome Revealed"].map((item, index) => (
                  <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <p className="font-mono text-xs font-black text-sky-300">0{index + 1}</p>
                    <p className="mt-3 text-sm font-black leading-6 text-white">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-amber-300/20 bg-amber-400/10 p-6 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-200">Research Trust</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-white">下一步不是更多功能，是建立研究信任。</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {researchTrust.map((item) => (
              <div key={item.title} className="rounded-3xl border border-amber-200/10 bg-zinc-950/70 p-5">
                <p className="text-lg font-black text-white">{item.title}</p>
                <p className="mt-2 text-sm leading-7 text-amber-100/80">{item.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/failed-signals" className="rounded-full border border-amber-200/30 px-5 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-200/10">
              查看失敗訊號
            </Link>
            <p className="rounded-full border border-zinc-700 bg-zinc-950 px-5 py-3 text-sm font-bold text-zinc-400">
              非投資建議，只做研究訊號追蹤與驗證
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
