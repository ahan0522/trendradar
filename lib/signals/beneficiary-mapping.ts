import type { MarketCode, SignalWatchlistItem } from "@/types/signals";

type RuleItem = {
  symbol: string;
  companyName: string;
  market: MarketCode;
};

type RuleGroup = {
  key: string;
  labels: string[];
  thesis: string;
  items: RuleItem[];
};

const ruleGroups: RuleGroup[] = [
  {
    key: "cpo-optical",
    labels: ["cpo", "co-packaged optics", "面板級封裝", "矽光子", "光通訊"],
    thesis: "CPO 與矽光子若進入量產，可提高高速光互連、光元件與封裝測試供應鏈的需求。",
    items: [
      { symbol: "6451.TW", companyName: "訊芯-KY", market: "TW" },
      { symbol: "3081.TW", companyName: "聯亞", market: "TW" },
      { symbol: "3363.TW", companyName: "上詮", market: "TW" },
      { symbol: "3163.TW", companyName: "波若威", market: "TW" },
      { symbol: "COHR", companyName: "Coherent", market: "US" },
      { symbol: "LITE", companyName: "Lumentum", market: "US" },
    ],
  },
  {
    key: "memory",
    labels: ["memory", "dram", "nand", "hbm", "記憶體", "內存"],
    thesis: "Memory and HBM demand may create pricing and capacity reallocation benefits.",
    items: [
      { symbol: "MU", companyName: "Micron", market: "US" },
      { symbol: "000660.KS", companyName: "SK Hynix", market: "KR" },
      { symbol: "005930.KS", companyName: "Samsung Electronics", market: "KR" },
      { symbol: "2408.TW", companyName: "南亞科", market: "TW" },
      { symbol: "2344.TW", companyName: "華邦電", market: "TW" },
      { symbol: "8299.TW", companyName: "群聯", market: "TW" },
    ],
  },
  {
    key: "ai-power",
    labels: ["ai power", "grid", "data center power", "power infrastructure", "電力", "電網", "資料中心電力", "變壓器"],
    thesis: "AI data center expansion can increase demand for power generation, grid equipment and power systems.",
    items: [
      { symbol: "GEV", companyName: "GE Vernova", market: "US" },
      { symbol: "ETN", companyName: "Eaton", market: "US" },
      { symbol: "ABB", companyName: "ABB", market: "US" },
      { symbol: "2308.TW", companyName: "台達電", market: "TW" },
      { symbol: "1513.TW", companyName: "中興電", market: "TW" },
      { symbol: "1519.TW", companyName: "華城", market: "TW" },
    ],
  },
  {
    key: "ai-cooling",
    labels: ["ai cooling", "liquid cooling", "thermal", "散熱", "液冷", "熱管理"],
    thesis: "Higher AI server rack density can accelerate demand for liquid cooling and advanced thermal management.",
    items: [
      { symbol: "VRT", companyName: "Vertiv", market: "US" },
      { symbol: "3017.TW", companyName: "奇鋐", market: "TW" },
      { symbol: "3324.TW", companyName: "雙鴻", market: "TW" },
      { symbol: "2308.TW", companyName: "台達電", market: "TW" },
    ],
  },
  {
    key: "advanced-packaging",
    labels: ["cowos", "advanced packaging", "semiconductor packaging", "先進封裝", "封裝"],
    thesis: "Advanced packaging capacity can become a bottleneck in AI accelerator supply chains.",
    items: [
      { symbol: "2330.TW", companyName: "台積電", market: "TW" },
      { symbol: "3711.TW", companyName: "日月光投控", market: "TW" },
      { symbol: "AMKR", companyName: "Amkor", market: "US" },
      { symbol: "3131.TW", companyName: "弘塑", market: "TW" },
      { symbol: "6187.TW", companyName: "萬潤", market: "TW" },
      { symbol: "3583.TW", companyName: "辛耘", market: "TW" },
    ],
  },
];

function normalizeText(value: string) {
  return value.toLowerCase();
}

function stableId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function mapBeneficiaries(signal: {
  topic: string;
  hypothesis?: string;
  signalEventId?: string;
}): SignalWatchlistItem[] {
  const text = normalizeText(`${signal.topic} ${signal.hypothesis ?? ""}`);
  const matched = ruleGroups.find((group) => group.labels.some((label) => text.includes(label)));

  if (!matched) {
    return [];
  }

  const weight = Number((1 / matched.items.length).toFixed(4));
  const signalEventId = signal.signalEventId ?? "pending";

  return matched.items.map((item) => ({
    id: `${signalEventId}-${stableId(item.symbol)}`,
    signalEventId,
    symbol: item.symbol,
    companyName: item.companyName,
    market: item.market,
    thesis: matched.thesis,
    weight,
    source: "rule-based",
  }));
}
