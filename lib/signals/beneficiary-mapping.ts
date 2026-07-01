import type { MarketCode, SignalWatchlistItem } from "@/types/signals";

type RuleItem = {
  symbol: string;
  companyName: string;
  market: MarketCode;
  valueChainRole?: string;
  causalReason?: string;
  trackingMetrics?: string[];
  invalidationConditions?: string[];
  mappingSources?: string[];
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
      {
        symbol: "NVDA",
        companyName: "NVIDIA",
        market: "US",
        valueChainRole: "資料中心 GPU、加速器與網路平台",
        causalReason: "NVIDIA 直接銷售資料中心 GPU、DGX/HGX 系統與高速網路平台，AI 算力建置會反映於 Data Center 營收與產品出貨。",
        trackingMetrics: ["Data Center 營收", "Blackwell／GPU 出貨進度", "雲端業者資本支出"],
        invalidationConditions: ["Data Center 營收成長停滯", "主要客戶延後 AI 基礎建設", "新平台量產或交付持續延後"],
        mappingSources: ["https://www.nvidia.com/en-us/data-center/"],
      },
      {
        symbol: "AMD",
        companyName: "Advanced Micro Devices",
        market: "US",
        valueChainRole: "資料中心 CPU 與 AI 加速器",
        causalReason: "AMD 以 EPYC CPU 與 Instinct 加速器直接參與 AI 資料中心建置，需求可由 Data Center 部門營收與加速器放量驗證。",
        trackingMetrics: ["Data Center 部門營收", "Instinct 加速器營收與出貨", "雲端客戶採用進度"],
        invalidationConditions: ["Data Center 部門營收轉弱", "Instinct 出貨未達公司指引", "主要雲端客戶採用延後"],
        mappingSources: ["https://www.amd.com/en/products/accelerators/instinct.html"],
      },
      {
        symbol: "2330.TW",
        companyName: "台積電",
        market: "TW",
        valueChainRole: "AI 晶片先進製程與晶圓代工",
        causalReason: "台積電直接製造 AI 加速器所需的先進製程晶片，需求可反映於 HPC 營收占比、先進製程營收與產能利用。",
        trackingMetrics: ["HPC 營收占比", "先進製程營收占比", "資本支出與產能利用率"],
        invalidationConditions: ["HPC 營收占比持續下降", "主要 AI 客戶拉貨或資本支出下修", "先進製程稼動率轉弱"],
        mappingSources: ["https://investor.tsmc.com/english"],
      },
      {
        symbol: "2317.TW",
        companyName: "鴻海",
        market: "TW",
        valueChainRole: "AI 伺服器系統組裝與機櫃整合",
        causalReason: "鴻海直接承接 AI 伺服器與機櫃系統製造，AI 基礎建設需求可反映於雲端網路產品營收、伺服器出貨與訂單。",
        trackingMetrics: ["雲端網路產品營收", "AI Server 出貨與營收", "伺服器訂單與產能"],
        invalidationConditions: ["AI Server 出貨未成長", "雲端網路產品營收轉弱", "客戶訂單或擴產計畫延後"],
        mappingSources: ["https://www.honhai.com/en-us/investor-relations"],
      },
      {
        symbol: "6669.TW",
        companyName: "緯穎",
        market: "TW",
        valueChainRole: "雲端資料中心伺服器與機櫃系統",
        causalReason: "緯穎直接供應雲端資料中心伺服器與整櫃系統，AI 建置需求可由伺服器營收、客戶資本支出與新平台量產驗證。",
        trackingMetrics: ["資料中心產品營收", "AI Server／整櫃出貨", "主要雲端客戶資本支出"],
        invalidationConditions: ["資料中心產品營收下滑", "主要客戶資本支出下修", "新平台量產或出貨延後"],
        mappingSources: ["https://www.wiwynn.com/investors"],
      },
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
      {
        symbol: "MU",
        companyName: "Micron",
        market: "US",
        valueChainRole: "DRAM、NAND 與 HBM 製造",
        causalReason: "Micron 直接生產 DRAM、NAND 與 HBM，記憶體供需變化會反映於位元出貨、平均售價、庫存與毛利率。",
        trackingMetrics: ["DRAM／NAND 平均售價", "HBM 營收與產能", "庫存天數與毛利率"],
        invalidationConditions: ["平均售價回落且庫存上升", "HBM 出貨或產能進度低於指引", "毛利率未隨報價改善"],
        mappingSources: ["https://www.micron.com/products/memory"],
      },
      { symbol: "000660.KS", companyName: "SK Hynix", market: "KR" },
      { symbol: "005930.KS", companyName: "Samsung Electronics", market: "KR" },
      {
        symbol: "2408.TW",
        companyName: "南亞科",
        market: "TW",
        valueChainRole: "標準型 DRAM 製造",
        causalReason: "南亞科營運直接連結標準型 DRAM，供需循環可由 DRAM 平均售價、位元出貨、庫存與稼動率驗證。",
        trackingMetrics: ["DRAM 平均售價", "位元出貨量", "庫存天數與稼動率"],
        invalidationConditions: ["DRAM 平均售價持續下跌", "庫存上升且稼動率未改善", "位元出貨未隨需求成長"],
        mappingSources: ["https://www.nanya.com/en/Ir"],
      },
      {
        symbol: "2344.TW",
        companyName: "華邦電",
        market: "TW",
        valueChainRole: "利基型 DRAM 與 NOR Flash 製造",
        causalReason: "華邦電直接供應利基型 DRAM 與 NOR Flash，相關供需可由產品報價、記憶體營收、庫存與產能利用率驗證。",
        trackingMetrics: ["利基型 DRAM／NOR 報價", "記憶體產品營收", "庫存與產能利用率"],
        invalidationConditions: ["利基型記憶體報價轉弱", "記憶體營收未改善", "庫存上升且產能利用率下降"],
        mappingSources: ["https://www.winbond.com/hq/about-winbond/investor-relations/"],
      },
      {
        symbol: "8299.TW",
        companyName: "群聯",
        market: "TW",
        valueChainRole: "NAND 控制晶片與儲存方案",
        causalReason: "群聯不生產 NAND，但直接提供控制晶片、韌體與儲存整合方案；受惠需由控制晶片出貨、企業級 SSD 與毛利結構驗證。",
        trackingMetrics: ["NAND 控制晶片出貨", "企業級 SSD／儲存方案營收", "毛利率與庫存"],
        invalidationConditions: ["控制晶片出貨下滑", "企業級儲存營收未成長", "NAND 報價波動造成庫存或毛利惡化"],
        mappingSources: ["https://www.phison.com/en/investor-relations"],
      },
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
      {
        symbol: "GEV",
        companyName: "GE Vernova",
        market: "US",
        valueChainRole: "發電設備、電網設備與大型變壓器",
        causalReason: "GE Vernova 直接供應發電與 Grid Solutions 設備，資料中心用電與電網投資可反映於訂單、積壓訂單及交付。",
        trackingMetrics: ["Grid 訂單與積壓訂單", "發電設備訂單", "大型變壓器產能與交期"],
        invalidationConditions: ["Grid 訂單或積壓訂單下滑", "公用事業延後電網投資", "產能擴張未轉化為交付與營收"],
        mappingSources: ["https://www.gevernova.com/grid-solutions/"],
      },
      {
        symbol: "ETN",
        companyName: "Eaton",
        market: "US",
        valueChainRole: "資料中心配電與電力管理設備",
        causalReason: "Eaton 直接供應資料中心配電、電能品質與電力管理設備，需求可由 Electrical 部門訂單、積壓訂單及資料中心曝險驗證。",
        trackingMetrics: ["Electrical 部門訂單", "Electrical 積壓訂單", "資料中心相關營收與產能"],
        invalidationConditions: ["Electrical 訂單轉弱", "資料中心專案延後", "新增產能未帶動營收或積壓訂單"],
        mappingSources: ["https://www.eaton.com/us/en-us/markets/data-centers.html"],
      },
      {
        symbol: "ABBNY",
        companyName: "ABB",
        market: "US",
        valueChainRole: "電氣化、配電與自動化設備",
        causalReason: "ABB Electrification 直接提供配電、電力保護與自動化方案，電網與資料中心建設可由部門訂單及營收驗證。",
        trackingMetrics: ["Electrification 訂單", "Electrification 營收", "資料中心與公用事業專案"],
        invalidationConditions: ["Electrification 訂單或營收下滑", "資料中心專案未形成訂單", "公用事業資本支出轉弱"],
        mappingSources: ["https://global.abb/group/en/investors"],
      },
      {
        symbol: "2308.TW",
        companyName: "台達電",
        market: "TW",
        valueChainRole: "資料中心電源、配電與能源管理",
        causalReason: "台達電直接供應伺服器電源、UPS、配電與資料中心基礎設施，AI 機櫃功率提升可由相關營收與出貨驗證。",
        trackingMetrics: ["基礎設施產品營收", "資料中心電源與 UPS 出貨", "AI Server 電源產品組合"],
        invalidationConditions: ["基礎設施營收未成長", "資料中心電源出貨轉弱", "高功率產品未改善產品組合"],
        mappingSources: ["https://www.deltaww.com/en-US/investorRelations"],
      },
      {
        symbol: "1513.TW",
        companyName: "中興電",
        market: "TW",
        valueChainRole: "輸配電、變電站與重電工程",
        causalReason: "中興電直接參與輸配電設備與變電工程，電網投資需由重電訂單、工程進度與在手訂單驗證。",
        trackingMetrics: ["重電設備訂單", "在手訂單與工程進度", "輸配電業務營收"],
        invalidationConditions: ["重電訂單下滑", "重大工程延後或取消", "在手訂單未轉化為營收"],
        mappingSources: ["https://www.chec.com.tw/"],
      },
      {
        symbol: "1519.TW",
        companyName: "華城",
        market: "TW",
        valueChainRole: "電力與配電變壓器、開關設備",
        causalReason: "華城直接生產電力及配電變壓器與開關設備，電網擴建可由變壓器訂單、外銷與產能交期驗證。",
        trackingMetrics: ["變壓器訂單與在手訂單", "外銷營收", "產能擴充與交期"],
        invalidationConditions: ["變壓器訂單轉弱", "電網專案延後", "新增產能未轉化為出貨與營收"],
        mappingSources: ["https://www.fortune.com.tw/"],
      },
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
    trackingMetrics: item.trackingMetrics ?? matched.trackingMetrics,
    invalidationConditions: item.invalidationConditions ?? matched.invalidationConditions,
    directOperatingLink: true,
    mappingVersion: "beneficiary-research-v2",
    mappingSources: item.mappingSources ?? [],
  }));
}
