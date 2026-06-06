import type { TopicAiInput, TopicAiOutput } from "@/lib/topic-ai";

type OpenAiSummaryResponse = {
  longTitle: string;
  summary: string;
  bullets: string[];
  subtopics: string[];
  tags: string[];
};

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    longTitle: { type: "string" },
    summary: { type: "string" },
    bullets: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 5,
    },
    subtopics: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 6,
    },
    tags: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 8,
    },
  },
  required: ["longTitle", "summary", "bullets", "subtopics", "tags"],
};

type OpenAiContentItem = {
  text?: unknown;
};

type OpenAiOutputItem = {
  content?: unknown;
};

type OpenAiResponsePayload = {
  output_text?: unknown;
  output?: unknown;
};

function getOpenAiText(response: OpenAiResponsePayload) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const output = Array.isArray(response.output) ? (response.output as OpenAiOutputItem[]) : [];
  const textParts = output.flatMap((item) =>
    Array.isArray(item.content)
      ? (item.content as OpenAiContentItem[])
          .map((content) => content.text)
          .filter((text: unknown): text is string => typeof text === "string")
      : []
  );

  return textParts.join("\n").trim();
}

function clampList(values: string[], maxLength: number) {
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, maxLength);
}

function normalizeSummaryResult(result: OpenAiSummaryResponse): TopicAiOutput {
  return {
    longTitle: result.longTitle.trim(),
    summary: result.summary.trim(),
    bullets: clampList(result.bullets, 5),
    subtopics: clampList(result.subtopics, 6),
    tags: clampList(result.tags, 8),
  };
}

export function isOpenAiSummaryEnabled() {
  return (
    process.env.AI_SUMMARY_PROVIDER === "openai" &&
    Boolean(process.env.OPENAI_API_KEY)
  );
}

export async function generateTopicAiSummaryWithOpenAi(
  input: TopicAiInput
): Promise<TopicAiOutput> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const model = process.env.OPENAI_SUMMARY_MODEL || "gpt-5-nano";
  const articlePayload = input.articles.slice(0, 8).map((article, index) => ({
    index: index + 1,
    title: article.title,
    description: article.description ?? "",
    sourceName: article.sourceName,
  }));

  const prompt = {
    topicTitle: input.topicTitle,
    category: input.category,
    keywords: input.keywords,
    articles: articlePayload,
    instructions: [
      "使用繁體中文。",
      "不要複製新聞標題。",
      "不要使用聳動語氣。",
      "不要使用股市標題常見的博眼球字眼，例如買爆、狂飆、眼紅、慘了、炸鍋。",
      "不要自行補不存在的事實。",
      "summary 用 2-3 句回答：誰做了什麼、目前結果是什麼、為什麼值得注意。",
      "bullets 應該是不重複、可直接給使用者看的事件重點，不要只是改寫標題。",
      "subtopics 和 tags 要短，像主題脈絡標籤。",
      "若來源是人物背景、市場反應或待確認資訊，要在重點文字中保留這個區分。",
      "若多篇文章其實是同一事件或同一通訊社來源，只整理一次，並在文字中用『多家轉載』或『同一來源延伸』概括。",
      "除非主題本身就是重大財經政策，避免把投信、外資買賣超、EPS、合併營收、股價漲跌寫成主要重點。",
    ],
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "你是 TrendRadar 的新聞整理助手，像冷靜的新聞編輯一樣，把多篇來源文章整理成快速理解的主題摘要。你的目標是降低使用者閱讀成本，而不是吸引點擊。",
      input: JSON.stringify(prompt),
      text: {
        format: {
          type: "json_schema",
          name: "trendradar_topic_summary",
          schema: SUMMARY_SCHEMA,
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI summary failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as OpenAiResponsePayload;
  const outputText = getOpenAiText(data);

  if (!outputText) {
    throw new Error("OpenAI summary returned empty output.");
  }

  return normalizeSummaryResult(JSON.parse(outputText));
}
