import Link from "next/link";
import { headers } from "next/headers";
import AiMindMap from "@/components/AiMindMap";
import { isPlatformSourceName } from "@/lib/source-scoring";

type TopicArticle = {
  id: string;
  title: string;
  description: string;
  quickSummary?: string;
  category: string;
  region: string;
  sourceId: string;
  sourceName: string;
  link: string;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type TopicDetail = {
  id: string;
  slug: string;
  title: string;
  longTitle: string;
  category: string;
  heroImageUrl: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
  summary: string;
  bullets: string[];
  subtopics: string[];
  tags: string[];
  ruleKey?: string;
  keywords?: string[];
  discoveryMode?: string;
  articles: TopicArticle[];
};

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "時間未知";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 1000 / 60);

  if (diffMinutes < 1) return "剛剛";
  if (diffMinutes < 60) return `${diffMinutes} 分鐘前`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

function getTopSources(articles: TopicArticle[]) {
  const sourceCounts = new Map<string, number>();

  articles.forEach((article) => {
    const sourceName = article.sourceName || "未知來源";
    if (isPlatformSourceName(sourceName)) return;
    sourceCounts.set(sourceName, (sourceCounts.get(sourceName) ?? 0) + 1);
  });

  return Array.from(sourceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
}

function formatDiscoveryMode(mode?: string) {
  if (mode === "rule_based") return "規則分群";
  if (mode === "candidate_cluster") return "自動候選分群";
  if (mode === "ai_discovered") return "AI 自動發現";
  return mode || "規則分群";
}

function isAiFixedTopic(topic: TopicDetail) {
  return topic.slug === "ai" || topic.ruleKey === "ai" || topic.title === "AI";
}

function isPlatformDigestTopic(topic: TopicDetail) {
  return (
    topic.discoveryMode === "candidate_cluster" &&
    topic.articleCount <= 1 &&
    topic.sourceCount > 1
  );
}

function cleanArticleTitle(title: string) {
  return title
    .replace(/\s+-\s+[^-]{2,40}$/g, "")
    .replace(/\s+\|\s+[^|]{2,40}$/g, "")
    .replace(/Yahoo新聞|Google News|UDN|自由時報|中時新聞網/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getEventHeadline(article: TopicArticle) {
  const summary = article.quickSummary || article.description;
  if (summary && summary.length <= 42) return summary;

  return cleanArticleTitle(article.title);
}

function getWhyItMatters(topic: TopicDetail, article: TopicArticle) {
  const text = `${topic.title} ${topic.summary} ${article.quickSummary} ${article.description}`;

  if (/關稅|貿易談判|301/.test(text)) {
    return "可能影響台灣出口、產業成本與後續談判走向，是政策與經濟面都需要追蹤的事件。";
  }

  if (/停火|美伊|伊朗|中東|以色列/.test(text)) {
    return "牽動區域安全、能源價格與國際外交互動，後續變化可能外溢到全球市場。";
  }

  if (/選舉|政局|執政黨|尹錫悅|南韓/.test(text)) {
    return "選舉結果會影響政府施政、政黨力量與區域外交判斷，適合放進今日國際脈絡。";
  }

  if (/法網|女雙|梁恩碩|大滿貫|網球/.test(text)) {
    return "這是台灣選手在國際賽事的焦點進展，重點在賽事成績與後續賽程。";
  }

  if (/AI|人工智慧|晶片|資料中心|機器人|模型/i.test(text)) {
    return "這反映 AI 產品、基礎建設或產業應用的最新動向，會影響科技投資與產品發展節奏。";
  }

  return "這是目前多篇報導共同指向的事件重點，可先用它掌握大致脈絡，再視需要點原文。";
}

function getTopicTopLine(topic: TopicDetail) {
  if (
    topic.summary &&
    !/^已先依去重後事件整理|目前已暫時隱藏/.test(topic.summary)
  ) {
    return topic.summary;
  }
  if (topic.bullets[0]) return topic.bullets[0];
  if (topic.articles[0]?.quickSummary) return topic.articles[0].quickSummary;

  return "這個主題正在整理中，系統會在下一次同步時補上完整快讀。";
}

function getTopicStatus(topic: TopicDetail) {
  if (topic.articleCount === 0) {
    return "目前系統已先擋下與主題不匹配的來源，這張卡暫時不展開細節，等待下一輪同步補上更可靠的報導。";
  }

  if (topic.articleCount === 1) {
    return topic.sourceCount > 0
      ? `目前只有 1 個去重後事件，已確認 ${topic.sourceCount} 個有效來源；先把它當成單一焦點追蹤，不過度放大。`
      : "目前只有 1 個去重後事件，而且來源仍偏平台聚合；先看事件本身，等後續同步補更多原始媒體。";
  }

  if (topic.sourceCount === 0) {
    return `目前已合併 ${topic.articleCount} 個去重後事件，但有效來源名稱仍不足；摘要會先以事件內容為主，不把平台聚合當成媒體聲量。`;
  }

  return `目前已合併 ${topic.articleCount} 個去重後事件、${topic.sourceCount} 個有效來源；相似轉載已盡量合併，避免同一件事重複出現。`;
}

function getSummaryConfidence(topic: TopicDetail) {
  if (topic.articleCount === 0) {
    return {
      label: "待補來源",
      tone: "bg-amber-50 text-amber-800",
      text: "相關性不足，暫時不產生強結論。",
    };
  }

  if (topic.sourceCount >= 3 && topic.articleCount >= 2) {
    return {
      label: "交叉確認",
      tone: "bg-emerald-50 text-emerald-800",
      text: "已有多個有效來源與事件支撐，可先作為今日焦點閱讀。",
    };
  }

  if (topic.articleCount >= 1) {
    return {
      label: "單點追蹤",
      tone: "bg-blue-50 text-blue-800",
      text: "目前先整理成單一事件，後續需看是否有更多來源跟進。",
    };
  }

  return {
    label: "整理中",
    tone: "bg-slate-100 text-slate-700",
    text: "等待下一輪同步補強。",
  };
}

function getTopicWhyItMatters(topic: TopicDetail) {
  const text = `${topic.title} ${topic.summary} ${topic.bullets.join(" ")}`;

  if (/關稅|貿易談判|301/.test(text)) {
    return "它可能影響台灣出口條件、產業成本與政府談判策略，後續變化會牽動企業布局與政策回應。";
  }

  if (/停火|美伊|伊朗|中東|以色列|台海|印太|國防/.test(text)) {
    return "它會影響區域安全判斷、國際外交表態與市場風險情緒，是需要持續追蹤的高影響事件。";
  }

  if (/選舉|政局|執政黨|尹錫悅|南韓/.test(text)) {
    return "選舉結果會改變政治力量分布，也可能影響政策推進、外交路線與後續國會互動。";
  }

  if (/法網|女雙|梁恩碩|大滿貫|網球/.test(text)) {
    return "這代表台灣選手在國際賽事中的重要進展，後續賽程與對手變化會決定討論熱度是否延續。";
  }

  if (/AI|人工智慧|晶片|資料中心|機器人|模型/i.test(text)) {
    return "AI 題材牽動產品、基礎建設與資本配置，相關事件常會延伸到科技供應鏈與監管討論。";
  }

  return "這個主題被整理出來，是因為多個訊號指向同一件事；先看這裡可以快速掌握今天的共同焦點。";
}

function getWhatToWatch(topic: TopicDetail) {
  const text = `${topic.title} ${topic.summary} ${topic.bullets.join(" ")}`;

  if (/關稅|貿易談判|301/.test(text)) {
    return ["美方最後稅率是否定案", "台灣政府與產業如何回應", "是否出現更多受影響產業名單"];
  }

  if (/停火|美伊|伊朗|中東|以色列/.test(text)) {
    return ["各方是否重新談判或升高衝突", "油價與市場風險情緒變化", "美方與區域盟友的下一步表態"];
  }

  if (/台海|印太|國防|美中/.test(text)) {
    return ["美中後續公開表態", "台灣政府回應與區域軍事動態", "周邊國家是否跟進表態"];
  }

  if (/選舉|政局|執政黨|尹錫悅|南韓/.test(text)) {
    return ["敗選或勝選陣營的後續聲明", "政策與人事是否調整", "民調與政黨支持度是否變化"];
  }

  if (/法網|女雙|梁恩碩|大滿貫|網球/.test(text)) {
    return ["下一場對手與賽程", "台將是否刷新紀錄", "國際媒體與球迷討論是否升溫"];
  }

  if (/AI|人工智慧|晶片|資料中心|機器人|模型/i.test(text)) {
    return ["是否有產品或合作正式落地", "供應鏈與資料中心需求是否延續", "監管、資安或商業模式的新訊號"];
  }

  return ["是否有更多原始來源補強", "相關人物或官方是否回應", "事件熱度是否延續到下一輪同步"];
}

async function getTopic(slug: string): Promise<TopicDetail | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) return null;

  const res = await fetch(
    `${protocol}://${host}/api/topics/db/${encodeURIComponent(slug)}`,
    {
      cache: "no-store",
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  return data.topic ?? null;
}

type TopicPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function TopicDetailPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const topic = await getTopic(slug);

  if (!topic) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 md:p-10">
        <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="text-2xl font-semibold text-slate-700">
            目前找不到這個主題
          </div>
          <p className="mt-3 text-sm text-slate-500">
            可能是今天沒有命中這個主題的新聞，或系統仍在整理最新資料。
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700"
          >
            返回首頁
          </Link>
        </div>
      </main>
    );
  }

  const topSources = getTopSources(topic.articles);
  const keywords = topic.keywords?.length ? topic.keywords : topic.tags;
  const showAiMindMap = isAiFixedTopic(topic);
  const platformDigest = isPlatformDigestTopic(topic);
  const topLine = getTopicTopLine(topic);
  const whyItMatters = getTopicWhyItMatters(topic);
  const whatToWatch = getWhatToWatch(topic);
  const topicStatus = getTopicStatus(topic);
  const confidence = getSummaryConfidence(topic);

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-800"
        >
          返回首頁
        </Link>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative">
            <img
              src={topic.heroImageUrl}
              alt={topic.title}
              className="h-72 w-full object-cover md:h-96"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/15 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white md:p-8">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">
                  {topic.category}
                </span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur">
                  {formatDiscoveryMode(topic.discoveryMode)}
                </span>
              </div>

              <h1 className="max-w-4xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
                {topic.longTitle}
              </h1>
            </div>
          </div>

          <div className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">熱度</div>
              <div className="mt-1 text-2xl font-bold text-slate-950">
                {topic.heatScore}
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">媒體覆蓋</div>
              <div className="mt-1 text-2xl font-bold text-slate-950">
                {topic.sourceCount} 家
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">來源文章</div>
              <div className="mt-1 text-2xl font-bold text-slate-950">
                {topic.articleCount} 篇
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs font-medium text-slate-500">最後更新</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">
                {formatRelativeTime(topic.updatedAt)}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-blue-700">
                  主題快讀
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${confidence.tone}`}>
                  {confidence.label}
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                先看這幾件事
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {confidence.text}
              </p>

              <div className="mt-5 grid gap-4">
                <div className="rounded-2xl bg-slate-950 p-5 text-white">
                  <div className="text-xs font-semibold tracking-[0.16em] text-sky-300">
                    發生什麼事
                  </div>
                  <p className="mt-2 text-lg font-semibold leading-8">
                    {topLine}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <div className="text-xs font-semibold tracking-[0.16em] text-blue-700">
                      目前狀態
                    </div>
                    <p className="mt-2 leading-7 text-slate-700">
                      {topicStatus}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                    <div className="text-xs font-semibold tracking-[0.16em] text-blue-700">
                      為什麼重要
                    </div>
                    <p className="mt-2 leading-7 text-slate-700">
                      {whyItMatters}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
                  <div className="text-xs font-semibold tracking-[0.16em] text-blue-700">
                    接下來看什麼
                  </div>
                  <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-700 md:grid-cols-3">
                    {whatToWatch.map((item) => (
                      <li key={item} className="flex gap-2 rounded-xl bg-white/70 px-3 py-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {platformDigest && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-sm font-semibold text-amber-800">
                    平台聚合焦點
                  </div>
                  <p className="mt-1 text-sm leading-6 text-amber-900">
                    這個主題目前來自平台聚合新聞，單一連結內已包含約 {topic.sourceCount} 家媒體的相關報導。後續若 RSS 抓到更多原始來源，系統會再自動補強與去重。
                  </p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {(topic.tags.length ? topic.tags : [topic.category]).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-blue-50 px-3 py-1.5 text-sm text-blue-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-semibold text-blue-700">關鍵脈絡</div>
              <h2 className="mt-1 text-2xl font-bold text-slate-950">
                摘要拆成可掃讀的重點
              </h2>

              {topic.bullets.length > 0 ? (
                <div className="mt-5 grid gap-3">
                  {topic.bullets.map((item, index) => (
                    <div
                      key={item}
                      className="grid gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[40px_minmax(0,1fr)]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                        {index + 1}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-500">
                          事件 {index + 1}
                        </div>
                        <p className="mt-1 leading-7 text-slate-700">{item}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  目前還沒有重點整理。
                </p>
              )}
            </section>

            {showAiMindMap ? (
              <AiMindMap topic={topic} />
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="text-sm font-semibold text-blue-700">主題脈絡</div>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">
                  目前可拆出的子主題
                </h2>

                <div className="mt-5 flex flex-wrap gap-2">
                  {(topic.subtopics.length
                    ? topic.subtopics
                    : ["尚未拆分子主題"]
                  ).map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-blue-700">來源文章</div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">
                    事件重點，不用點開也能快速看懂
                  </h2>
                </div>
                <div className="text-sm text-slate-500">
                  {platformDigest
                    ? `平台聚合約 ${topic.sourceCount} 家媒體`
                    : `已合併相似來源，共 ${topic.articles.length} 則`}
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {topic.articles.map((article) => (
                  <a
                    key={article.id}
                    href={article.link}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`查看原文：${article.title}`}
                    className="block rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                      <div>
                        <div className="text-xs font-semibold text-blue-700">
                          發生什麼事
                        </div>
                        <h3 className="mt-1 text-lg font-bold leading-7 text-slate-950">
                          {getEventHeadline(article)}
                        </h3>
                        <p className="mt-2 text-base leading-7 text-slate-700">
                          {article.quickSummary ||
                            article.description ||
                            "目前只有原始來源，系統會在下一次同步時補上重點整理。"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-blue-50/70 p-4">
                        <div className="text-xs font-semibold text-blue-700">
                          為什麼重要
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {getWhyItMatters(topic, article)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      {platformDigest && (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                          聚合焦點
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        {article.sourceName || "未知來源"}
                      </span>
                      {article.category && (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                          {article.category}
                        </span>
                      )}
                      {article.region && (
                        <span className="rounded-full bg-slate-50 px-3 py-1">
                          {article.region}
                        </span>
                      )}
                      {article.publishedAt && (
                        <span>{formatRelativeTime(article.publishedAt)}</span>
                      )}
                      <span className="font-medium text-slate-700">
                        查看原文 →
                      </span>
                    </div>
                  </a>
                ))}
                {topic.articles.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6">
                    <div className="text-lg font-semibold text-slate-800">
                      暫時沒有可放心展開的來源
                    </div>
                    <p className="mt-2 leading-7 text-slate-600">
                      系統有偵測到這個主題，但目前抓到的文章與主題核心不夠匹配，所以先不把它們放進摘要。下一次同步如果出現更相關的原始報導，這裡會自動補上。
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-semibold text-blue-700">主題抓取</div>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                這張卡如何被建立
              </h2>

              <div className="mt-5 space-y-4">
                <div>
                  <div className="text-xs font-medium text-slate-500">發現模式</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {formatDiscoveryMode(topic.discoveryMode)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">規則 ID</div>
                  <div className="mt-1 font-mono text-sm text-slate-700">
                    {topic.ruleKey || topic.slug}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">命中訊號</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {keywords.slice(0, 10).map((keyword) => (
                      <span
                        key={keyword}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-semibold text-blue-700">媒體分布</div>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                主要來源
              </h2>

              <div className="mt-5 space-y-3">
                {topSources.map(([sourceName, count]) => (
                  <div
                    key={sourceName}
                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {sourceName}
                    </span>
                    <span className="text-sm text-slate-500">{count} 篇</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
