import Link from "next/link";

const workflow = [
  "Global Information",
  "Topic Intelligence",
  "Investable Filter",
  "Signal Detection",
  "Investment Thesis",
  "Beneficiary Mapping",
  "Backtesting",
  "Signal Ledger",
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
    label: "News websites",
    text: "Tell you what happened today.",
  },
  {
    label: "ChatGPT",
    text: "Helps summarize information.",
  },
  {
    label: "TrendRadar",
    text: "Tracks whether a market signal becomes a validated research case.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="rounded-[2rem] border border-sky-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.24),_transparent_34%),#090b13] p-6 shadow-2xl shadow-sky-950/30 md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-300">AI-Powered Market Research Platform</p>
              <h1 className="mt-4 max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
                Discover market signals before they become consensus.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300">
                TrendRadar is not another AI news summary tool. It turns global information flow into verifiable market signals, then stores every thesis, watchlist, timeline, backtest, outcome, and lesson in a Signal Ledger.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/signals" className="rounded-full bg-white px-6 py-3 text-sm font-black text-zinc-950 transition hover:bg-sky-100">
                  Open Signal Ledger
                </Link>
                <Link href="/reports/signal-validation" className="rounded-full border border-zinc-700 bg-zinc-950 px-6 py-3 text-sm font-bold text-zinc-200 transition hover:border-sky-400/60">
                  View Validation Report
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">The moat</p>
              <h2 className="mt-3 text-2xl font-black">Signal Ledger</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                AI is the assistant. The durable asset is the database of market signals that can be reviewed, validated, and improved over time.
              </p>
              <div className="mt-5 grid gap-2">
                {["Signal", "Thesis", "Watchlist", "Timeline", "Backtest", "Outcome", "Lessons"].map((item) => (
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
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Research Workflow</p>
              <h2 className="mt-2 text-2xl font-black">From information flow to validated signal</h2>
            </div>
            <p className="text-sm text-zinc-600">Every step should be inspectable, not a black-box AI answer.</p>
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
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">First Market</p>
            <h2 className="mt-2 text-2xl font-black">AI Infrastructure</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              Phase 1 focuses on HBM, DRAM, NAND, CoWoS, cooling, power, grid, and networking because public evidence is available and outcomes can be validated.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950/90 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">MVP</p>
            <h2 className="mt-2 text-2xl font-black">5 complete historical case studies</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {caseStudies.map((item) => (
                <div key={item} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 font-bold text-zinc-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Product Principle</p>
          <h2 className="mt-2 text-2xl font-black text-white">Evidence before automation.</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-amber-100/80">
            The next milestone is not more feeds or more AI. The next milestone is building full case studies that show what TrendRadar saw at the time, what thesis it formed, and what happened afterward.
          </p>
        </section>
      </div>
    </main>
  );
}
