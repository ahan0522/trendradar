import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getHeroImageForCategory } from "@/lib/topic-home";
import { createServiceRoleClient } from "../../../../utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type HomeTopic = {
  id: string;
  slug: string;
  title: string;
  category: string;
  heroImageUrl: string;
  heatScore: number;
  sourceCount: number;
  articleCount: number;
  updatedAt: string;
  discoveryMode: string;
  quickSummary?: string;
  sourceQuality?: {
    label: string;
    tone: "strong" | "medium" | "weak";
  };
};

function getTopicFamily(topic: HomeTopic) {
  const text = `${topic.title} ${topic.slug} ${topic.category}`.toLowerCase();

  if (/普丁|澤倫斯基|俄烏|烏克蘭|俄羅斯|停火談判|和平談判|russia|ukraine/.test(text)) {
    return "russia-ukraine";
  }

  if (/伊朗|美軍|美伊|中東|以色列|黎巴嫩|真主黨|停火|iran|israel/.test(text)) {
    return "middle-east";
  }

  if (/台海|東海|中國海警|兩岸|國防|軍演|taiwan-security/.test(text)) {
    return "taiwan-security";
  }

  if (/槍擊|槍手|開槍|槍殺|死傷|命危|車禍|自撞|撞擊|受困|送醫|搶救|刑案|詐騙|詐欺|殺人|縱火|爆炸|火災|公共安全/.test(text)) {
    return "social-incident";
  }

  if (/機器人|具身|robot|robotics|自動化/.test(text)) {
    return "ai-robotics";
  }

  if (/輝達|黃仁勳|nvidia|晶片|半導體|伺服器|資料中心|gpu/.test(text)) {
    return "ai-infrastructure";
  }

  if (/ai|人工智慧|模型|審查|監管|行政命令|policy|regulation/.test(text)) {
    return "ai-policy";
  }

  if (/nba|籃球|季後賽|總冠軍/.test(text)) {
    return "basketball";
  }

  if (/法網|網球|女雙|大滿貫|tennis/.test(text)) {
    return "tennis";
  }

  return topic.category || "general";
}

function getReliableCategory(topic: Pick<HomeTopic, "title" | "slug" | "category">) {
  const text = `${topic.title} ${topic.slug} ${topic.category}`.toLowerCase();

  if (/普丁|澤倫斯基|俄烏|烏克蘭|俄羅斯|停火談判|和平談判|russia|ukraine/.test(text)) {
    return "國際";
  }

  if (/伊朗|美軍|美伊|中東|以色列|黎巴嫩|真主黨|iran|israel/.test(text)) {
    return "國際";
  }

  if (/伊波拉|cdc|who|疫情|確診|疫苗|冠狀病毒|廣效疫苗|公衛/.test(text)) {
    return "生活";
  }

  if (/雷雨|豪雨|強降雨|暴雨|颱風|熱帶低壓|淹水|防災|氣象|航班|機場/.test(text)) {
    return "生活";
  }

  if (/南韓|韓國|尹錫悅|李在明|韓成淑|女總理|內閣|總理提名|選舉/.test(text)) {
    return "政治";
  }

  if (/台海|東海|中國海警|兩岸|國防|軍演|taiwan-security/.test(text)) {
    return "台海";
  }

  if (/槍擊|槍手|開槍|槍殺|死傷|命危|車禍|自撞|撞擊|受困|送醫|搶救|刑案|詐騙|詐欺|殺人|縱火|爆炸|火災|公共安全|social-incident/.test(text)) {
    return "社會";
  }

  if (/法網|網球|女雙|大滿貫|tennis|nba|籃球|棒球|中職/.test(text)) {
    return "體育";
  }

  return topic.category || "新聞";
}

function isBroadFallbackTopic(topic: HomeTopic) {
  const title = topic.title.trim().toLowerCase();

  return (
    topic.discoveryMode !== "candidate_cluster" &&
    /^(ai|nba|iphone|3c|財經|國際|新聞|體育)$/.test(title)
  );
}

function getDiversityScore(topic: HomeTopic) {
  const discoveryBoost = topic.discoveryMode === "candidate_cluster" ? 600 : 0;
  const sourceBoost = Math.min(topic.sourceCount, 5) * 80;
  const articleBoost = Math.min(topic.articleCount, 8) * 30;
  const fallbackPenalty = isBroadFallbackTopic(topic) ? 900 : 0;

  return discoveryBoost + sourceBoost + articleBoost + topic.heatScore - fallbackPenalty;
}

function toTextList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanHomeSummary(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^這個主題目前發生什麼事[:：]?\s*/u, "")
    .trim();
}

function shortenText(value: string, maxLength = 92) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function getTitleSignals(title: string) {
  return title
    .split(/[、，,／/｜|：:；;（）()\s與和及]+/u)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2)
    .filter((item) => !/^(討論|戰況|事故|議題|焦點|新聞|整理|周邊|競爭|研發)$/u.test(item));
}

function isSummaryAlignedWithTitle(title: string, value: string) {
  const signals = getTitleSignals(title);

  if (signals.length === 0) {
    return true;
  }

  return signals.some((signal) => value.toLowerCase().includes(signal.toLowerCase()));
}

function isStockMarketNoise(value: string) {
  return /股價|台股|美股|投信|外資|買超|賣超|eps|營收|合併營收|月營收|殖利率|本益比|kospi|指數|開盤|收盤/i.test(
    value
  );
}

function isBroadAiTopic(title: string, category: string) {
  return title.trim().toLowerCase() === "ai" || category.trim().toLowerCase() === "ai";
}

function shouldDeferBroadAiTopic(topic: {
  title: string;
  category: string;
  summary?: string | null;
  bullets?: unknown;
}) {
  if (!isBroadAiTopic(topic.title, topic.category)) {
    return false;
  }

  const summary = cleanHomeSummary(topic.summary ?? "");
  const bullets = toTextList(topic.bullets).join(" ");

  return isStockMarketNoise(`${summary} ${bullets}`);
}

function getHomeQuickSummary(topic: {
  title: string;
  category: string;
  summary?: string | null;
  bullets?: unknown;
  sourceCount: number;
  articleCount: number;
}) {
  const summary = cleanHomeSummary(topic.summary ?? "");
  const shouldAvoidStoredSummary =
    isBroadAiTopic(topic.title, topic.category) && isStockMarketNoise(summary);

  if (
    summary &&
    !shouldAvoidStoredSummary &&
    isSummaryAlignedWithTitle(topic.title, summary) &&
    !/近期與「.+」相關的熱門新聞共有/u.test(summary) &&
    !/焦點集中在最新發展、事件結果與延伸影響/u.test(summary)
  ) {
    return shortenText(summary);
  }

  const bullet = toTextList(topic.bullets)[0];

  if (
    bullet &&
    !(isBroadAiTopic(topic.title, topic.category) && isStockMarketNoise(bullet)) &&
    isSummaryAlignedWithTitle(topic.title, bullet)
  ) {
    return shortenText(cleanHomeSummary(bullet));
  }

  if (isBroadAiTopic(topic.title, topic.category)) {
    return "AI 主題目前只保留與人工智慧、模型、晶片基建或機器人直接相關的訊號，股價與買賣超類短訊會先降權。";
  }

  return shortenText(
    `系統已把 ${topic.articleCount} 篇相關新聞整理成「${topic.title}」，方便快速掌握 ${topic.category} 焦點。`
  );
}

function getHomeSourceQuality(topic: Pick<HomeTopic, "sourceCount" | "articleCount">) {
  if (topic.sourceCount >= 3 && topic.articleCount >= 2) {
    return {
      label: "交叉確認",
      tone: "strong" as const,
    };
  }

  if (topic.sourceCount >= 2 || topic.articleCount >= 2) {
    return {
      label: "來源補強中",
      tone: "medium" as const,
    };
  }

  return {
    label: "早期訊號",
    tone: "weak" as const,
  };
}

function selectDiverseHomeTopics(topics: HomeTopic[], targetCount: number) {
  const selected: HomeTopic[] = [];
  const categoryCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();

  function addTopic(topic: HomeTopic, categoryLimit: number, familyLimit: number) {
    if (selected.some((item) => item.id === topic.id)) {
      return false;
    }

    const categoryCount = categoryCounts.get(topic.category) ?? 0;
    const family = getTopicFamily(topic);
    const familyCount = familyCounts.get(family) ?? 0;

    if (categoryCount >= categoryLimit || familyCount >= familyLimit) {
      return false;
    }

    selected.push(topic);
    categoryCounts.set(topic.category, categoryCount + 1);
    familyCounts.set(family, familyCount + 1);
    return true;
  }

  const strongTopics = topics
    .filter((topic) => !isBroadFallbackTopic(topic))
    .sort((a, b) => getDiversityScore(b) - getDiversityScore(a));

  for (const topic of strongTopics) {
    addTopic(topic, 1, 1);

    if (selected.length >= targetCount) {
      return selected;
    }
  }

  if (selected.length >= targetCount) {
    return selected;
  }

  for (const topic of strongTopics) {
    addTopic(topic, 2, 1);

    if (selected.length >= targetCount) {
      return selected;
    }
  }

  if (selected.length >= targetCount) {
    return selected;
  }

  for (const topic of topics.sort((a, b) => getDiversityScore(b) - getDiversityScore(a))) {
    addTopic(topic, targetCount > 6 ? 3 : 2, 2);

    if (selected.length >= targetCount) {
      return selected;
    }
  }

  return selected.slice(0, targetCount);
}

function summarizeCategories(topics: HomeTopic[]) {
  const counts = new Map<string, number>();

  topics.forEach((topic) => {
    const category = topic.category || "未分類";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }));
}

function getHomeQualityStatus(topics: HomeTopic[], targetCount: number) {
  if (topics.length === 0) {
    return {
      level: "empty",
      label: "整理中",
      description: "目前沒有通過品質門檻的大主題，系統會在下一輪同步後重新整理。",
    };
  }

  if (topics.length < Math.min(4, targetCount)) {
    return {
      level: "limited",
      label: "精選不足",
      description: "系統只顯示來源與去重後事件都夠穩的主題，因此目前數量較少。",
    };
  }

  return {
    level: "healthy",
    label: "品質穩定",
    description: "目前主題已通過來源、去重與分類多元檢查。",
  };
}

export async function GET(request: NextRequest) {
  try {
    const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 6);
    const topicLimit = Math.min(Math.max(requestedLimit, 3), 12);
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from("topics")
      .select(`
        id,
        slug,
        title,
        category,
        hero_image_url,
        heat_score,
        summary,
        bullets,
        source_count,
        article_count,
        last_article_published_at,
        last_synced_at,
        discovery_mode,
        status
      `)
      .eq("status", "active")
      .not("slug", "is", null)
      .gt("article_count", 0)
      .gt("source_count", 0)
      .order("heat_score", { ascending: false })
      .limit(36);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: `讀取 topics 失敗: ${error.message}`,
        },
        { status: 500 }
      );
    }

    const activeTopics = (data ?? [])
      .map((topic) => {
        const category = getReliableCategory({
          title: topic.title,
          slug: topic.slug,
          category: topic.category ?? "",
        });
        const originalCategory = topic.category ?? "";
        const deferBroadAiTopic = shouldDeferBroadAiTopic({
          title: topic.title,
          category,
          summary: topic.summary,
          bullets: topic.bullets,
        });
        const sourceCount = deferBroadAiTopic ? 0 : topic.source_count ?? 0;
        const articleCount = deferBroadAiTopic ? 0 : topic.article_count ?? 0;

        return {
          id: topic.id,
          slug: topic.slug,
          title: topic.title,
          category,
          heroImageUrl:
            originalCategory === category && topic.hero_image_url
              ? topic.hero_image_url
              : getHeroImageForCategory(category),
          heatScore: topic.heat_score ?? 0,
          sourceCount,
          articleCount,
          updatedAt:
            topic.last_article_published_at ??
            topic.last_synced_at ??
            new Date().toISOString(),
          discoveryMode: topic.discovery_mode ?? "rule_based",
          quickSummary: getHomeQuickSummary({
            title: topic.title,
            category,
            summary: topic.summary,
            bullets: topic.bullets,
            sourceCount,
            articleCount,
          }),
          sourceQuality: getHomeSourceQuality({
            sourceCount,
            articleCount,
          }),
        };
      })
      .sort((a, b) => {
        if (a.discoveryMode !== b.discoveryMode) {
          return a.discoveryMode === "candidate_cluster" ? -1 : 1;
        }

        const scoreDiff = getDiversityScore(b) - getDiversityScore(a);

        if (scoreDiff !== 0) {
          return scoreDiff;
        }

        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    const topics = selectDiverseHomeTopics(activeTopics, topicLimit);
    const generatedAt = new Date().toISOString();
    const newestUpdatedAt =
      topics
        .map((topic) => topic.updatedAt)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ??
      generatedAt;

    return NextResponse.json(
      {
        ok: true,
        selectionMode: "diverse-category-family-v3",
        generatedAt,
        count: topics.length,
        targetCount: topicLimit,
        activeTopicCount: activeTopics.length,
        newestUpdatedAt,
        qualityStatus: getHomeQualityStatus(topics, topicLimit),
        categorySummary: summarizeCategories(topics),
        topics,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知錯誤";

    return NextResponse.json(
      {
        ok: false,
        error: `db-home 執行失敗: ${message}`,
      },
      { status: 500 }
    );
  }
}
