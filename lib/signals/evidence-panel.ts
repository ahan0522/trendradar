import type {
  SignalEvidenceCategory,
  SignalEvidencePanelItem,
} from "@/types/signals";

type EvidenceInput = {
  sourceType: string;
  knownAtSignalTime: boolean;
  title?: string;
  sourceName?: string;
};

type ComponentInput = {
  componentName: string;
  normalizedScore: number;
};

type OutcomeInput = {
  outcome: string;
  excess_return: number;
};

const labels: Record<SignalEvidenceCategory, string> = {
  news: "新聞事件",
  industry: "產業指標",
  commodity: "商品報價",
  company: "企業行動",
  supply_chain: "供應鏈",
  market: "市場驗證",
};

function classify(item: EvidenceInput): SignalEvidenceCategory {
  if (item.sourceType === "news") return "news";
  if (["company_action", "official"].includes(item.sourceType)) return "company";
  if (item.sourceType === "commodity") return "commodity";
  if (item.sourceType === "market") return "market";
  if (item.sourceType === "supply_chain") return "supply_chain";
  if (item.sourceType === "industry") return "industry";
  if (item.sourceType === "price") {
    const text = `${item.title ?? ""} ${item.sourceName ?? ""}`;
    return /原油|天然氣|銅|黃金|dram|nand|commodity|fred/i.test(text)
      ? "commodity"
      : "market";
  }
  return "industry";
}

function statusFor(score: number, count: number): SignalEvidencePanelItem["status"] {
  if (count === 0) return "missing";
  if (score >= 65) return "confirmed";
  return "partial";
}

export function buildSignalEvidencePanel(input: {
  evidenceItems?: EvidenceInput[];
  scoreComponents?: ComponentInput[];
  outcomes?: OutcomeInput[];
}) {
  const evidenceItems = (input.evidenceItems ?? []).filter((item) => item.knownAtSignalTime);
  const components = input.scoreComponents ?? [];
  const outcomes = input.outcomes ?? [];
  const categories: SignalEvidenceCategory[] = [
    "news",
    "industry",
    "commodity",
    "company",
    "supply_chain",
    "market",
  ];

  return categories.map((category): SignalEvidencePanelItem => {
    const matched = evidenceItems.filter((item) => classify(item) === category);
    let score = Math.min(100, matched.length * 18);
    let summary = matched.length > 0
      ? `${matched.length} 筆符合 as_of_date 的可追溯證據。`
      : "目前沒有符合 as_of_date 的可追溯證據。";

    if (category === "market") {
      const completed = outcomes.filter((item) => item.outcome !== "pending");
      const positive = completed.filter((item) => Number(item.excess_return) >= 0);
      const priceComponent = components.find((item) => item.componentName === "priceSpike");
      score = completed.length > 0
        ? Math.round((positive.length / completed.length) * 100)
        : Number(priceComponent?.normalizedScore ?? score);
      summary = completed.length > 0
        ? `${positive.length}/${completed.length} 個成熟區間未落後基準。`
        : priceComponent
          ? `已有價格異常分數 ${Number(priceComponent.normalizedScore).toFixed(0)}，尚待成熟回測。`
          : summary;
      return {
        category,
        label: labels[category],
        status:
          completed.some((item) => item.outcome === "failed") && positive.length === 0
            ? "contradicted"
            : statusFor(score, completed.length + matched.length + (priceComponent ? 1 : 0)),
        score,
        evidenceCount: completed.length + matched.length,
        summary,
      };
    }

    return {
      category,
      label: labels[category],
      status: statusFor(score, matched.length),
      score,
      evidenceCount: matched.length,
      summary,
    };
  });
}
