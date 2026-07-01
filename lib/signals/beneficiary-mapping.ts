import type { MarketCode, SignalWatchlistItem } from "@/types/signals";

type RuleItem = {
  symbol: string;
  companyName: string;
  market: MarketCode;
  valueChainRole?: string;
  causalReason?: string;
};

type RuleGroup = {
  key: string;
  labels: string[];
  thesis: string;
  valueChainRole: string;
  causalReason: string;
  trackingMetrics: string[];
  invalidationConditions: string[];
  items: RuleItem[];
};

const ruleGroups: RuleGroup[] = [
  {
    key: "semiconductor",
    labels: ["半導體", "先進製程", "semiconductor", "晶圓代工", "晶片設備"],
    thesis: "半導體與先進製程需求若持續擴張，晶圓代工、微影、製程設備與封裝測試供應鏈值得持續追蹤。",
    valueChainRole: "半導體製造與設備",
    causalReason: "公司營收直接來自晶圓製造、封測或關鍵製程設備，需求變化可反映於接單、產能與稼動率。",
    trackingMetrics: ["先進製程／封裝產能", "設備訂單與積壓訂單", "稼動率與資本支出"],
    invalidationConditions: ["相關業務營收占比下降", "客戶資本支出或產能計畫下修", "訂單與稼動率未隨需求敘事改善"],
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
    valueChainRole: "AI 加速器與伺服器供應鏈",
    causalReason: "公司直接供應 AI 加速器、先進製程或伺服器系統，AI 基礎建設支出會影響其出貨與營收。",
    trackingMetrics: ["AI Server 出貨量", "GPU／加速器營收", "雲端業者資本支出", "先進製程需求"],
    invalidationConditions: ["AI 相關出貨或營收未成長", "主要雲端客戶資本支出下修", "供應瓶頸解除但公司未取得增量訂單"],
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
    valueChainRole: "國防主承包與軍用系統",
    causalReason: "公司直接承接政府國防、航太或軍用系統合約，預算與採購可轉化為積壓訂單。",
    trackingMetrics: ["國防預算與合約金額", "積壓訂單", "交付時程", "軍用業務營收"],
    invalidationConditions: ["預算未轉化為正式合約", "專案取消或延後", "軍用業務占比不足以構成營運影響"],
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
    valueChainRole: "機器人與工業自動化",
    causalReason: "公司直接銷售機器人、運動控制或工業自動化產品，採用率會影響訂單與相關業務收入。",
    trackingMetrics: ["機器人／自動化訂單", "工業資本支出", "相關業務營收", "庫存與交期"],
    invalidationConditions: ["自動化訂單持續下滑", "製造業資本支出收縮", "公司產品未進入目標應用"],
    items: [
      { symbol: "ABBNY", companyName: "ABB", market: "US" },
      { symbol: "ROK", companyName: "Rockwell Automation", market: "US" },
      { symbol: "TER", companyName: "Teradyne", market: "US" },
      { symbol: "2049.TW", companyName: "上銀", market: "TW" },
    ],
  },
  {
    key: "cpo-optical",
    labels: ["cpo", "co-packaged optics", "面板級封裝", "矽光子", "光通訊"],
    thesis: "CPO 與矽光子若進入量產，可提高高速光互連、光元件與封裝測試供應鏈的需求。",
    valueChainRole: "高速光通訊與矽光子元件",
    causalReason: "公司直接供應高速光元件、耦合元件或相關封裝服務，量產導入會影響產品組合與出貨。",
    trackingMetrics: ["800G／1.6T 出貨", "CPO 客戶認證", "光通訊營收占比", "量產時程"],
    invalidationConditions: ["客戶認證或量產延後", "高速產品營收未提升", "公司未揭露直接供貨或營運關聯"],
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
    valueChainRole: "記憶體製造與控制晶片",
    causalReason: "公司直接生產 DRAM／NAND、HBM 或儲存控制晶片，報價、庫存與產能配置會影響營收及毛利。",
    trackingMetrics: ["DRAM／NAND／HBM 報價", "庫存天數", "位元出貨量", "產能與稼動率"],
    invalidationConditions: ["報價與出貨未改善", "庫存持續上升", "新增產能造成供給過剩", "相關產品營收占比顯著下降"],
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
    valueChainRole: "電網與資料中心電力設備",
    causalReason: "公司直接供應發電、輸配電、變壓器或資料中心電源設備，電力建設會反映於訂單與產能。",
    trackingMetrics: ["電網／變壓器訂單", "資料中心電力設備營收", "產能與交期", "公用事業資本支出"],
    invalidationConditions: ["電力建設延後或取消", "訂單未轉化為營收", "公司缺乏資料中心或電網直接曝險"],
    items: [
      { symbol: "GEV", companyName: "GE Vernova", market: "US" },
      { symbol: "ETN", companyName: "Eaton", market: "US" },
      { symbol: "ABBNY", companyName: "ABB", market: "US" },
      { symbol: "2308.TW", companyName: "台達電", market: "TW" },
      { symbol: "1513.TW", companyName: "中興電", market: "TW" },
      { symbol: "1519.TW", companyName: "華城", market: "TW" },
    ],
  },
  {
    key: "ai-cooling",
    labels: ["ai cooling", "liquid cooling", "thermal", "散熱", "液冷", "熱管理"],
    thesis: "若 AI 伺服器機櫃功率密度持續提高，液冷與高階熱管理需求值得持續追蹤。",
    valueChainRole: "資料中心液冷與熱管理",
    causalReason: "公司直接供應伺服器散熱、液冷或資料中心熱管理系統，機櫃功率密度提升會增加產品需求。",
    trackingMetrics: ["液冷營收與出貨", "AI Server 散熱產品組合", "客戶認證", "單櫃功率密度"],
    invalidationConditions: ["液冷滲透率未提升", "客戶認證或量產延後", "相關營收未隨 AI Server 出貨成長"],
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
    valueChainRole: "先進封裝、封測與設備",
    causalReason: "公司直接提供先進封裝產能、封測服務或關鍵設備，擴產會影響訂單、出貨與稼動率。",
    trackingMetrics: ["CoWoS／先進封裝產能", "設備訂單", "封測稼動率", "擴產資本支出"],
    invalidationConditions: ["擴產計畫下修", "設備訂單或稼動率未改善", "公司未取得先進封裝直接訂單"],
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

function matchRuleGroup(text: string) {
  return ruleGroups
    .map((group, index) => {
      const matchedLabels = group.labels.filter((label) => text.includes(label));
      return {
        group,
        index,
        matchedLabels,
        score: matchedLabels.reduce((sum, label) => sum + label.length, 0),
      };
    })
    .filter((match) => match.matchedLabels.length > 0)
    .sort((a, b) =>
      b.matchedLabels.length - a.matchedLabels.length ||
      b.score - a.score ||
      a.index - b.index
    )[0]?.group;
}

export function mapBeneficiaries(signal: {
  topic: string;
  hypothesis?: string;
  signalEventId?: string;
}): SignalWatchlistItem[] {
  const text = normalizeText(`${signal.topic} ${signal.hypothesis ?? ""}`);
  const matched = matchRuleGroup(text);

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
    valueChainRole: item.valueChainRole ?? matched.valueChainRole,
    causalReason: item.causalReason ?? matched.causalReason,
    trackingMetrics: matched.trackingMetrics,
    invalidationConditions: matched.invalidationConditions,
    directOperatingLink: true,
  }));
}
