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
  positionClass: string;
  accentClass: string;
  softClass: string;
  connectorClass: string;
};

const AI_MIND_MAP_BRANCHES: MindMapBranch[] = [
  {
    id: "model-product",
    title: "模型與產品",
    description: "模型發布、產品功能、Agent 與平台服務。",
    pattern: /openai|anthropic|模型|生成式|agent|代理ai|產品|發布|siri|apple intelligence/i,
    positionClass: "lg:col-start-1 lg:row-start-1 lg:self-end",
    accentClass: "bg-blue-600",
    softClass: "bg-blue-50 text-blue-700",
    connectorClass: "lg:left-[calc(100%+1rem)] lg:top-1/2 lg:h-px lg:w-16",
  },
  {
    id: "infrastructure",
    title: "晶片與基礎建設",
    description: "GPU、資料中心、AI 伺服器與算力供應鏈。",
    pattern: /輝達|nvidia|gpu|晶片|半導體|伺服器|資料中心|算力|hbm|散熱/i,
    positionClass: "lg:col-start-3 lg:row-start-1 lg:self-end",
    accentClass: "bg-cyan-600",
    softClass: "bg-cyan-50 text-cyan-700",
    connectorClass: "lg:right-[calc(100%+1rem)] lg:top-1/2 lg:h-px lg:w-16",
  },
  {
    id: "robotics",
    title: "機器人與應用",
    description: "具身 AI、人型機器人與產業落地場景。",
    pattern: /機器人|具身|實體ai|physical ai|自動化|邊緣 ai|應用/i,
    positionClass: "lg:col-start-1 lg:row-start-3 lg:self-start",
    accentClass: "bg-emerald-600",
    softClass: "bg-emerald-50 text-emerald-700",
    connectorClass: "lg:left-[calc(100%+1rem)] lg:top-1/2 lg:h-px lg:w-16",
  },
  {
    id: "policy",
    title: "政策與監管",
    description: "政府規範、模型安全、審查與企業合規。",
    pattern: /政策|監管|審查|行政命令|模型安全|合規|white house|trump|executive order/i,
    positionClass: "lg:col-start-3 lg:row-start-3 lg:self-start",
    accentClass: "bg-violet-600",
    softClass: "bg-violet-50 text-violet-700",
    connectorClass: "lg:right-[calc(100%+1rem)] lg:top-1/2 lg:h-px lg:w-16",
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

      <div className="relative mt-6 lg:min-h-[600px]">
        <div className="absolute left-1/2 top-1/2 hidden h-[70%] w-px -translate-x-1/2 -translate-y-1/2 bg-slate-200 lg:block" />
        <div className="absolute left-1/2 top-1/2 hidden h-px w-[72%] -translate-x-1/2 -translate-y-1/2 bg-slate-200 lg:block" />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)_220px_minmax(0,1fr)] lg:gap-x-24 lg:gap-y-8">
          <div className="relative order-first rounded-[32px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6 text-center shadow-sm lg:order-none lg:col-start-2 lg:row-start-2 lg:flex lg:flex-col lg:items-center lg:justify-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-950 text-3xl font-black text-white shadow-lg shadow-slate-300/70">
              AI
            </div>
            <div className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
              Center Node
            </div>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
              今日 AI 新聞先拆成四條線，點分支後再看該線的重點摘要。
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
                className={`relative rounded-[24px] border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${branch.positionClass} ${
                  isSelected
                    ? "border-slate-950 bg-white shadow-md"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div
                  className={`absolute hidden bg-slate-300 ${branch.connectorClass}`}
                />
                <div className="absolute -left-px top-6 h-10 w-1 rounded-r-full bg-slate-300 lg:hidden" />
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 h-4 w-4 shrink-0 rounded-full ${branch.accentClass}`}
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-950">
                        {branch.title}
                      </h3>
                      {isSelected && (
                        <span className="rounded-full bg-slate-950 px-2 py-0.5 text-xs font-medium text-white">
                          正在查看
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {branch.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs ${branch.softClass}`}>
                    {branch.articles.length} 則相關
                  </span>
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500">
                    點擊展開
                  </span>
                </div>
              </button>
            );
          })}
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
