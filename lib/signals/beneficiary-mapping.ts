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
    key: "semiconductor",
    labels: ["半導體", "先進製程", "semiconductor", "晶圓代工", "晶片設備"],
    thesis: "半導體與先進製程需求若持續擴張，晶圓代工、微影、製程設備與封裝測試供應鏈值得持續追蹤。",
    items: [
      { symbol: "2330.TW", companyName: "台積電", market: "TW" },
      { symbol: "3711.TW", companyName: "日月光投控", market: "TW" },
      { symbol: "ASML", companyName: "ASML", market: "US" },
      { symbol: "AMAT", companyName: "Applied Materials", market: "US" },
      { symbol: "LRCX", companyName: "Lam Research", market: "US" },
    ],
  },
  {
    key: "ai-compute",
    labels: ["ai 算力", "ai算力", "ai data center", "ai資料中心", "ai 基礎建設", "ai基礎建設"],
    thesis: "AI 算力與資料中心擴張若持續，GPU、先進製程、伺服器組裝與雲端基礎建設供應鏈值得持續追蹤。",
    items: [
      { symbol: "NVDA", companyName: "NVIDIA", market: "US" },
      { symbol: "AMD", companyName: "Advanced Micro Devices", market: "US" },
      { symbol: "2330.TW", companyName: "台積電", market: "TW" },
      { symbol: "2317.TW", companyName: "鴻海", market: "TW" },
      { symbol: "6669.TW", companyName: "緯穎", market: "TW" },
    ],
  },
  {
    key: "defense",
    labels: ["國防", "軍工", "軍售", "無人機", "飛彈", "地緣風險"],
    thesis: "國防支出與地緣風險若持續升高，航太、飛彈防禦、軍用電子與無人系統供應商值得持續追蹤。",
    items: [
      { symbol: "LMT", companyName: "Lockheed Martin", market: "US" },
      { symbol: "RTX", companyName: "RTX", market: "US" },
      { symbol: "NOC", companyName: "Northrop Grumman", market: "US" },
      { symbol: "GD", companyName: "General Dynamics", market: "US" },
      { symbol: "2634.TW", companyName: "漢翔", market: "TW" },
    ],
  },
  {
    key: "robotics",
    labels: ["機器人", "自動化", "robotics", "協作機器人"],
    thesis: "工業自動化與機器人採用若持續擴大，運動控制、工業軟硬體與機器人平台供應商值得持續追蹤。",
    items: [
      { symbol: "ABB", companyName: "ABB", market: "US" },
      { symbol: "ROK", companyName: "Rockwell Automation", market: "US" },
      { symbol: "TER", companyName: "Teradyne", market: "US" },
      { symbol: "2049.TW", companyName: "上銀", market: "TW" },
    ],
  },
  {
    key: "cpo-optical",
    labels: ["cpo", "co-packaged optics", "面板級封裝", "矽光子", "光通訊"],
    thesis: "CPO 與矽光子若進入量產，可提高高速光互連、光元件與封裝測試供應鏈的需求。",
    items: [
      { symbol: "6451.TW", companyName: "訊芯-KY", market: "TW" },
      { symbol: "3081.TW", companyName: "聯亞", market: "TW" },
      { symbol: "3363.TW", companyName: "上詮", market: "TW" },
      { symbol: "3163.TW", companyName: "波若威", market: "TW" },
    ],
  },
  {
    key: "memory",
    labels: ["memory", "dram", "nand", "hbm", "記憶體", "內存"],
    thesis: "若 HBM 與記憶體需求持續擴張，DRAM／NAND 報價、產能重新配置與供應商稼動率值得持續追蹤。",
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
    thesis: "若 AI 資料中心持續擴建，發電、電網設備、變壓器與資料中心電力系統需求值得持續追蹤。",
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
    thesis: "若 AI 伺服器機櫃功率密度持續提高，液冷與高階熱管理需求值得持續追蹤。",
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
    thesis: "若先進封裝產能持續成為 AI 加速器供應瓶頸，封測產能、設備與材料供應鏈值得持續追蹤。",
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
