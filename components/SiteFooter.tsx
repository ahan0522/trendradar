import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-[#05070d] px-4 py-8 text-zinc-500 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <p className="font-black text-zinc-200">TrendRadar</p>
          <p className="mt-2 max-w-3xl text-sm leading-7">
            TrendRadar is a market research platform. It provides research signals, historical validation, and educational analysis. It does not provide investment advice, price targets, or buy/sell recommendations.
          </p>
          <p className="mt-3 max-w-3xl text-xs leading-6 text-zinc-600">
            All signals are research candidates and may be wrong. Users should verify source data and make independent decisions.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/signals" className="hover:text-white">Signal Ledger</Link>
          <Link href="/reports/signal-validation" className="hover:text-white">Validation Report</Link>
        </div>
      </div>
    </footer>
  );
}
