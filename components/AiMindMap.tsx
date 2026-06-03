"use client";

import { useMemo, useState } from "react";

type TopicArticle = {
  id: string;
  title: string;
  description: string;
  quickSummary?: string;
  category: string;
  region: string;
  sourceName: string;
  link: string;
};

type TopicDetail = {
  title: string;
  articles: TopicArticle[];
};

type MindMapBranch = {
  id: string;
  title: string;
  description: string;
  pattern: RegExp;
  moleculeClass: string;
  accentClass: string;
  softClass: string;
  bondClass: string;
  childSignals: string[];
  childNodeClasses: string[];
  childBondClasses: string[];
};

const AI_MIND_MAP_BRANCHES: MindMapBranch[] = [
  {
    id: "model-product",
    title: "模型與產品",
    description: "模型發布、產品功能、Agent 與平台服務。",
    pattern: /openai|anthropic|模型|生成式|agent|代理ai|產品|發布|siri|apple intelligence/i,
    moleculeClass: "lg:left-[10%] lg:top-[13%]",
    accentClass: "bg-blue-600",
    softClass: "bg-blue-50 text-blue-700",
    bondClass:
      "lg:left-[27%] lg:top-[31%] lg:h-1 lg:w-[28%] lg:rotate-[28deg]",
    childSignals: ["OpenAI", "Agent", "產品發布"],
    childNodeClasses: [
      "lg:left-[3%] lg:top-[3%]",
      "lg:left-[24%] lg:top-[2%]",
      "lg:left-[2%] lg:top-[35%]",
    ],
    childBondClasses: [
      "lg:left-[13%] lg:top-[13%] lg:h-0.5 lg:w-[11%] lg:-rotate-[22deg]",
      "lg:left-[24%] lg:top-[19%] lg:h-0.5 lg:w-[11%] lg:rotate-[28deg]",
      "lg:left-[13%] lg:top-[34%] lg:h-0.5 lg:w-[10%] lg:rotate-[18deg]",
    ],
  },
  {
    id: "infrastructure",
    title: "晶片與基礎建設",
    description: "GPU、資料中心、AI 伺服器與算力供應鏈。",
    pattern: /輝達|nvidia|gpu|晶片|半導體|伺服器|資料中心|算力|hbm|散熱/i,
    moleculeClass: "lg:right-[9%] lg:top-[16%]",
    accentClass: "bg-cyan-600",
    softClass: "bg-cyan-50 text-cyan-700",
    bondClass:
      "lg:right-[27%] lg:top-[33%] lg:h-1 lg:w-[27%] lg:-rotate-[26deg]",
    childSignals: ["GPU", "資料中心", "供應鏈"],
    childNodeClasses: [
      "lg:right-[3%] lg:top-[4%]",
      "lg:right-[24%] lg:top-[2%]",
      "lg:right-[2%] lg:top-[37%]",
    ],
    childBondClasses: [
      "lg:right-[13%] lg:top-[14%] lg:h-0.5 lg:w-[11%] lg:rotate-[22deg]",
      "lg:right-[24%] lg:top-[19%] lg:h-0.5 lg:w-[11%] lg:-rotate-[28deg]",
      "lg:right-[13%] lg:top-[36%] lg:h-0.5 lg:w-[10%] lg:-rotate-[18deg]",
    ],
  },
  {
    id: "robotics",
    title: "機器人與應用",
    description: "具身 AI、人型機器人與產業落地場景。",
    pattern: /機器人|具身|實體ai|physical ai|自動化|邊緣 ai|應用/i,
    moleculeClass: "lg:left-[13%] lg:bottom-[12%]",
    accentClass: "bg-emerald-600",
    softClass: "bg-emerald-50 text-emerald-700",
    bondClass:
      "lg:left-[29%] lg:bottom-[31%] lg:h-1 lg:w-[25%] lg:-rotate-[31deg]",
    childSignals: ["具身 AI", "人型機器人", "產業落地"],
    childNodeClasses: [
      "lg:left-[3%] lg:bottom-[3%]",
      "lg:left-[25%] lg:bottom-[2%]",
      "lg:left-[2%] lg:bottom-[36%]",
    ],
    childBondClasses: [
      "lg:left-[13%] lg:bottom-[13%] lg:h-0.5 lg:w-[11%] lg:rotate-[22deg]",
      "lg:left-[24%] lg:bottom-[19%] lg:h-0.5 lg:w-[11%] lg:-rotate-[28deg]",
      "lg:left-[13%] lg:bottom-[35%] lg:h-0.5 lg:w-[10%] lg:-rotate-[18deg]",
    ],
  },
  {
    id: "policy",
    title: "政策與監管",
    description: "政府規範、模型安全、審查與企業合規。",
    pattern: /政策|監管|審查|行政命令|模型安全|合規|white house|trump|executive order/i,
    moleculeClass: "lg:right-[13%] lg:bottom-[10%]",
    accentClass: "bg-violet-600",
    softClass: "bg-violet-50 text-violet-700",
    bondClass:
      "lg:right-[29%] lg:bottom-[31%] lg:h-1 lg:w-[25%] lg:rotate-[31deg]",
    childSignals: ["行政命令", "模型安全", "合規審查"],
    childNodeClasses: [
      "lg:right-[3%] lg:bottom-[3%]",
      "lg:right-[25%] lg:bottom-[2%]",
      "lg:right-[2%] lg:bottom-[36%]",
    ],
    childBondClasses: [
      "lg:right-[13%] lg:bottom-[13%] lg:h-0.5 lg:w-[11%] lg:-rotate-[22deg]",
      "lg:right-[24%] lg:bottom-[19%] lg:h-0.5 lg:w-[11%] lg:rotate-[28deg]",
      "lg:right-[13%] lg:bottom-[35%] lg:h-0.5 lg:w-[10%] lg:rotate-[18deg]",
    ],
  },
];

function getBranchArticles(branch: MindMapBranch, articles: TopicArticle[]) {
  return articles
    .filter((article) =>
      branch.pattern.test(
        `${article.title} ${article.description} ${article.quickSummary ?? ""}`
      )
    )
    .slice(0, 4);
}

function getFallbackBranchArticles(index: number, articles: TopicArticle[]) {
  return articles.slice(index * 2, index * 2 + 2);
}

function getArticleSummary(article: TopicArticle) {
  return (
    article.quickSummary ||
    article.description ||
    "目前只有原始來源，系統會在下一次同步時補上重點整理。"
  );
}

export default function AiMindMap({ topic }: { topic: TopicDetail }) {
  const [selectedBranchId, setSelectedBranchId] = useState(
    AI_MIND_MAP_BRANCHES[0].id
  );

  const branches = useMemo(
    () =>
      AI_MIND_MAP_BRANCHES.map((branch, index) => {
        const matchedArticles = getBranchArticles(branch, topic.articles);
        const articles = matchedArticles.length
          ? matchedArticles
          : getFallbackBranchArticles(index, topic.articles);

        return {
          ...branch,
          articles,
        };
      }),
    [topic.articles]
  );

  const selectedBranch =
    branches.find((branch) => branch.id === selectedBranchId) ?? branches[0];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-blue-700">AI 主題地圖</div>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">
            點一條分支，先看這個方向在說什麼
          </h2>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          可點選測試版
        </div>
      </div>

      <div className="relative mt-6 overflow-hidden rounded-[32px] border border-slate-100 bg-[radial-gradient(circle_at_center,_#f8fbff_0,_#f8fafc_42%,_#eef4ff_100%)] p-4 lg:min-h-[560px]">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:28px_28px]" />

        <div className="relative grid gap-3 lg:block lg:min-h-[528px]">
          {branches.map((branch) => (
            <div
              key={`${branch.id}-bond`}
              className={`pointer-events-none absolute hidden origin-center rounded-full bg-slate-300 shadow-[0_0_0_5px_rgba(255,255,255,0.75)] lg:block ${branch.bondClass}`}
            />
          ))}

          {selectedBranch.childBondClasses.map((bondClass, index) => (
            <div
              key={`${selectedBranch.id}-child-bond-${index}`}
              className={`pointer-events-none absolute hidden origin-center rounded-full bg-slate-300/80 lg:block ${bondClass}`}
            />
          ))}

          <div className="relative rounded-[32px] border border-blue-100 bg-white/90 p-5 text-center shadow-sm backdrop-blur lg:absolute lg:left-1/2 lg:top-1/2 lg:z-10 lg:flex lg:h-48 lg:w-48 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:flex-col lg:items-center lg:justify-center lg:rounded-full lg:p-6">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-950 text-3xl font-black text-white shadow-lg shadow-slate-300/70">
              AI
            </div>
            <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Core
            </div>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
              今日 AI 新聞先拆成外圍訊號，點節點後再看該線的重點摘要。
            </p>
          </div>

          {branches.map((branch) => {
            const isSelected = branch.id === selectedBranch.id;

            return (
              <button
                key={branch.id}
                type="button"
                onClick={() => setSelectedBranchId(branch.id)}
                aria-pressed={isSelected}
                className={`relative z-10 rounded-[28px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 lg:absolute lg:flex lg:h-36 lg:w-36 lg:flex-col lg:items-center lg:justify-center lg:rounded-full lg:p-4 lg:text-center ${branch.moleculeClass} ${
                  isSelected
                    ? "scale-[1.03] border-slate-950 bg-white shadow-xl shadow-slate-300/60"
                    : "border-slate-200 bg-white/85"
                }`}
              >
                <div className="absolute -left-px top-6 h-10 w-1 rounded-r-full bg-slate-300 lg:hidden" />
                <div className="flex items-start gap-3 lg:flex-col lg:items-center">
                  <div
                    className={`mt-1 h-4 w-4 shrink-0 rounded-full lg:h-7 lg:w-7 ${branch.accentClass}`}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2 lg:justify-center">
                      <h3 className="text-lg font-bold leading-snug text-slate-950 lg:text-base">
                        {branch.title}
                      </h3>
                      {isSelected && (
                        <span className="rounded-full bg-slate-950 px-2 py-0.5 text-xs font-medium text-white lg:hidden">
                          正在查看
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600 lg:hidden">
                      {branch.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 lg:justify-center">
                  <span className={`rounded-full px-3 py-1 text-xs ${branch.softClass}`}>
                    {branch.articles.length} 則相關
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 lg:hidden">
                    點擊展開
                  </span>
                </div>
              </button>
            );
          })}

          {selectedBranch.childSignals.map((signal, index) => (
            <button
              key={`${selectedBranch.id}-${signal}`}
              type="button"
              onClick={() => setSelectedBranchId(selectedBranch.id)}
              className={`relative z-20 hidden h-20 w-20 rounded-full border border-white bg-white/95 px-2 text-center text-xs font-semibold leading-snug text-slate-700 shadow-lg shadow-slate-300/50 transition hover:-translate-y-0.5 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 lg:absolute lg:flex lg:items-center lg:justify-center ${selectedBranch.childNodeClasses[index]}`}
            >
              <span className={`absolute -top-1 h-3 w-3 rounded-full ${selectedBranch.accentClass}`} />
              {signal}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`h-4 w-4 rounded-full ${selectedBranch.accentClass}`}
            />
            <div>
              <div className="text-sm font-semibold text-blue-700">
                目前分支
              </div>
              <h3 className="text-2xl font-bold text-slate-950">
                {selectedBranch.title}
              </h3>
            </div>
          </div>
          <div className="rounded-full bg-white px-3 py-1 text-sm text-slate-500">
            {selectedBranch.articles.length} 則摘要
          </div>
        </div>

        <p className="mt-3 leading-7 text-slate-600">
          {selectedBranch.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {selectedBranch.childSignals.map((signal) => (
            <span
              key={signal}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${selectedBranch.softClass}`}
            >
              {signal}
            </span>
          ))}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {selectedBranch.articles.length > 0 ? (
            selectedBranch.articles.map((article) => (
              <a
                key={`${selectedBranch.id}-${article.id}`}
                href={article.link}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="text-xs font-semibold text-blue-700">
                  分支快讀
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-800">
                  {getArticleSummary(article)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    {article.sourceName || "未知來源"}
                  </span>
                  {article.category && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                      {article.category}
                    </span>
                  )}
                  {article.region && (
                    <span className="rounded-full bg-slate-50 px-2.5 py-1">
                      {article.region}
                    </span>
                  )}
                </div>
              </a>
            ))
          ) : (
            <div className="rounded-2xl bg-white p-4 text-sm text-slate-500">
              目前這條分支還在等待更多來源。
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
