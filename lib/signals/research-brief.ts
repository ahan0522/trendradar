import type { SignalResearchBrief } from "@/types/signals";

type ResearchSignal = {
  topic: string;
  hypothesis: string;
  signalStrength: number;
  confidenceScore: number;
  asOfDate: string;
  evidence: unknown[];
};

type ResearchEvidence = {
  sourceName?: string;
  sourceType: string;
  knownAtSignalTime: boolean;
};

type ResearchWatchlist = {
  symbol: string;
  thesis: string;
  trackingMetrics?: string[];
  invalidationConditions?: string[];
  directOperatingLink?: boolean;
};

type ResearchOutcome = {
  horizon_days: number;
  excess_return: number;
  outcome: string;
};

type ResearchScoreComponent = {
  componentName: string;
  normalizedScore: number;
};

type LaneDefinition = {
  key: string;
  pattern: RegExp;
  whyNow: string;
  causalChain: string[];
  trackingIndicators: string[];
  invalidationConditions: string[];
  beneficiaryLogic: string;
};

const laneDefinitions: LaneDefinition[] = [
  {
    key: "memory",
    pattern: /memory|dram|nand|hbm|記憶體/i,
    whyNow: "記憶體循環通常先反映在報價、庫存、產能配置與供應商展望，可能比財報更早顯示供需方向改變。",
    causalChain: ["AI／終端需求改變", "HBM、DRAM 或 NAND 產能重新配置", "庫存與合約報價變化", "供應商稼動率與毛利率受到影響"],
    trackingIndicators: ["DRAM、NAND、HBM 合約報價與庫存", "主要供應商產能配置、資本支出與展望", "觀察籃子相對半導體基準的表現"],
    invalidationConditions: ["報價轉跌且通路庫存重新上升", "主要供應商下修需求、稼動率或資本支出", "新聞熱度升高但公司營運資料沒有同步改善"],
    beneficiaryLogic: "優先觀察直接生產記憶體、控制晶片或受產能重新配置影響的公司，而不是只因名稱與 AI 有關就納入。",
  },
  {
    key: "semiconductor",
    pattern: /semiconductor|晶片|半導體|晶圓|先進製程/i,
    whyNow: "先進製程需求若同步出現在設備、晶圓代工與封測環節，可能代表需求正在由單一新聞擴散成完整供應鏈活動。",
    causalChain: ["運算或終端需求增加", "先進製程與晶圓產能需求提高", "設備、材料及封測訂單變化", "供應鏈營收與利用率逐步驗證"],
    trackingIndicators: ["晶圓代工利用率、先進製程產能與交期", "設備商訂單、出貨與公司展望", "封測需求是否與晶圓端同步"],
    invalidationConditions: ["客戶延後資本支出或取消訂單", "先進製程利用率下降、交期縮短", "只有股價題材，缺乏訂單或公司公告支持"],
    beneficiaryLogic: "觀察籃子涵蓋晶圓代工、微影、製程設備與封裝測試，目的是驗證需求是否跨越供應鏈，而非押注單一股票。",
  },
  {
    key: "power",
    pattern: /power|grid|transformer|electric|電力|電網|變壓器|核能/i,
    whyNow: "若資料中心與工業投資的瓶頸由算力轉向供電，需求可能擴散到發電、電網、變壓器、UPS 與電力管理設備。",
    causalChain: ["資料中心或工業用電需求提高", "既有電網與供電容量形成瓶頸", "電力設備交期與在手訂單增加", "設備商營收與資本支出受到驗證"],
    trackingIndicators: ["資料中心新增容量與用電預估", "變壓器、電網設備交期及在手訂單", "設備業者營收、毛利率與展望"],
    invalidationConditions: ["資料中心建置延期或取消", "設備交期縮短且在手訂單下滑", "政策與電網投資沒有轉化為實際採購"],
    beneficiaryLogic: "優先觀察具有電網設備、變壓器、UPS 或資料中心電力管理曝險的公司。",
  },
  {
    key: "defense",
    pattern: /defense|military|war|國防|軍工|軍售|飛彈|戰爭|地緣/i,
    whyNow: "地緣事件只有在國防預算、採購或補庫存需求跟進時，才可能從短期新聞轉化為可持續的產業訊號。",
    causalChain: ["地緣風險或軍事需求升高", "政府提高預算、採購或補充庫存", "主承包商與供應鏈訂單增加", "交付、營收與現金流逐步驗證"],
    trackingIndicators: ["各國國防預算與正式採購公告", "主要承包商在手訂單與 book-to-bill", "事件降溫後訂單是否仍持續"],
    invalidationConditions: ["衝突降溫且沒有新增採購", "預算未通過或交付持續延後", "股價反應只來自事件情緒，基本面沒有變化"],
    beneficiaryLogic: "觀察標的以具有政府合約、軍用電子、航太或防禦系統曝險的公司為主，並需用正式採購驗證。",
  },
  {
    key: "energy",
    pattern: /energy|oil|gas|commodity|能源|原油|油價|天然氣|原物料|黃金|銅價/i,
    whyNow: "能源與原物料訊號必須同時觀察供給事件、現貨／期貨價格與企業成本曝險，單靠新聞量不足以判斷投資方向。",
    causalChain: ["供給、運輸或政策出現變化", "商品價格與期限結構反應", "產業成本或生產商利潤改變", "公司財測與現金流逐步驗證"],
    trackingIndicators: ["現貨、期貨價格及期限結構", "產量、庫存與運輸中斷資料", "生產商與下游公司的成本或財測變化"],
    invalidationConditions: ["供給快速恢復且商品價格回落", "價格變動沒有持續到企業營運", "候選只由單一地緣事件驅動"],
    beneficiaryLogic: "在商品價格與企業曝險資料完成前，不應直接建立受惠股票清單；先保留為產業研究候選。",
  },
  {
    key: "biotech",
    pattern: /biotech|health|drug|medical|生技|醫療|新藥|藥物|疫苗/i,
    whyNow: "醫療新聞必須區分公共議題、單一臨床事件與可投資的產品里程碑，只有後兩者具備明確公司與驗證路徑時才適合建立標的。",
    causalChain: ["臨床、法規或醫療需求出現變化", "產品里程碑或採用率改變", "適應症市場與商業化機率重估", "公司營收、授權或現金流驗證"],
    trackingIndicators: ["臨床試驗終點與同儕審查資料", "FDA／TFDA 等正式法規文件", "公司現金水位、授權與商業化進度"],
    invalidationConditions: ["試驗未達主要終點或安全性出現問題", "法規時程延後或申請遭拒", "新聞只有公共健康討論，沒有可辨識公司曝險"],
    beneficiaryLogic: "沒有產品、公司與法規里程碑的直接連結時，不建立股票映射，避免把醫療熱度誤判為投資訊號。",
  },
  {
    key: "general",
    pattern: /.*/,
    whyNow: "當多個獨立來源、公司行動與市場資料朝同一方向變化時，才可能代表產業趨勢正在形成，而不只是短期新聞熱度。",
    causalChain: ["市場事件或需求變化", "產業供需與企業行動開始反應", "相關公司營運數據出現變化", "價格與相對報酬進行前瞻驗證"],
    trackingIndicators: ["獨立來源是否持續增加", "公司公告或產業數據是否支持假設", "觀察籃子相對 benchmark 的表現"],
    invalidationConditions: ["證據來源停止增加或出現相反資訊", "公司營運沒有反映新聞敘事", "觀察籃子持續落後 benchmark"],
    beneficiaryLogic: "只有在產業因果關係與公司營運曝險都可說明時，才建立觀察標的。",
  },
];

function metric(signal: ResearchSignal) {
  return (signal.evidence[0] ?? {}) as {
    source_count?: number;
    article_count?: number;
  };
}

function findLane(signal: ResearchSignal) {
  const text = `${signal.topic} ${signal.hypothesis}`;
  return laneDefinitions.find((item) => item.pattern.test(text)) ?? laneDefinitions[laneDefinitions.length - 1];
}

function evidenceAssessment(signal: ResearchSignal, evidenceItems: ResearchEvidence[]) {
  const data = metric(signal);
  const independentSourceCount = Number(data.source_count ?? new Set(evidenceItems.map((item) => item.sourceName).filter(Boolean)).size);
  const knownEvidence = evidenceItems.filter((item) => item.knownAtSignalTime);
  const primaryEvidence = knownEvidence.filter((item) =>
    ["official", "company_action", "supply_chain", "price"].includes(item.sourceType),
  );
  const hasBreadth = independentSourceCount >= 3 && knownEvidence.length >= 3;
  const level = primaryEvidence.length >= 2 && hasBreadth
    ? "high"
    : hasBreadth
      ? "medium"
      : "early";
  const labels = { high: "高：已有一手資料交叉驗證", medium: "中：具跨來源新聞證據", early: "早期：仍需補一手資料" } as const;

  return {
    level,
    label: labels[level],
    summary: primaryEvidence.length > 0
      ? `訊號形成時已有 ${knownEvidence.length} 筆證據，其中 ${primaryEvidence.length} 筆為官方、公司、供應鏈或價格資料。`
      : `目前主要由 ${independentSourceCount} 個來源的新聞與主題資料形成，尚缺官方、公司或產業數據交叉驗證。`,
    knownEvidenceCount: knownEvidence.length,
    primaryEvidenceCount: primaryEvidence.length,
    independentSourceCount,
  } satisfies SignalResearchBrief["evidenceAssessment"];
}

function validationSummary(outcomes: ResearchOutcome[]) {
  const completed = outcomes
    .filter((item) => item.outcome !== "pending")
    .sort((a, b) => b.horizon_days - a.horizon_days);
  const latest = completed[0];
  if (!latest) {
    return {
      label: "等待前瞻驗證",
      summary: "目前尚無成熟的回測期間；訊號形成日之後的資料只會用於結果驗證，不會回填研究假設。",
    };
  }

  const excess = Number(latest.excess_return);
  const formatted = `${excess >= 0 ? "+" : ""}${excess.toFixed(2)}%`;
  const labels: Record<string, string> = {
    success: "目前成立",
    partial: "目前部分成立",
    failed: "目前未通過",
  };
  return {
    label: labels[latest.outcome] ?? "驗證中",
    summary: `最新成熟區間為 ${latest.horizon_days} 日，觀察籃子相對基準的超額報酬為 ${formatted}。這是研究結果，不是未來報酬保證。`,
  };
}

export function buildSignalResearchBrief(input: {
  signal: ResearchSignal;
  evidenceItems?: ResearchEvidence[];
  watchlists?: ResearchWatchlist[];
  outcomes?: ResearchOutcome[];
  scoreComponents?: ResearchScoreComponent[];
}): SignalResearchBrief {
  const evidenceItems = input.evidenceItems ?? [];
  const watchlists = input.watchlists ?? [];
  const outcomes = input.outcomes ?? [];
  const components = input.scoreComponents ?? [];
  const lane = findLane(input.signal);
  const assessment = evidenceAssessment(input.signal, evidenceItems);
  const componentNames = new Set(components.map((item) => item.componentName));
  const mappedTrackingIndicators = [...new Set(watchlists.flatMap((item) => item.trackingMetrics ?? []))];
  const mappedInvalidationConditions = [...new Set(watchlists.flatMap((item) => item.invalidationConditions ?? []))];
  const directMappings = watchlists.filter((item) => item.directOperatingLink === true);
  const gaps: string[] = [];

  if (assessment.primaryEvidenceCount === 0) gaps.push("缺少官方公告、公司行動、供應鏈或價格等一手證據。");
  if (assessment.independentSourceCount < 3) gaps.push("獨立來源不足 3 個，仍可能受到單一媒體或轉載污染。");
  if (directMappings.length === 0) gaps.push("尚未建立具直接營運關係的公司曝險與受惠標的映射。");
  if (!componentNames.has("priceSpike")) gaps.push("訊號分數尚未納入可驗證的價格異常資料。");
  if (!componentNames.has("companyActivity")) gaps.push("訊號分數尚未納入正式公司行動資料。");
  if (gaps.length === 0) gaps.push("核心資料已齊備，仍需等待後續時間窗口與反方證據持續驗證。");

  return {
    lane: lane.key,
    whyNow: lane.whyNow,
    causalChain: lane.causalChain,
    trackingIndicators: mappedTrackingIndicators.length > 0 ? mappedTrackingIndicators : lane.trackingIndicators,
    invalidationConditions: mappedInvalidationConditions.length > 0 ? mappedInvalidationConditions : lane.invalidationConditions,
    evidenceAssessment: assessment,
    beneficiaryLogic: directMappings.length > 0
      ? `${lane.beneficiaryLogic} 本次共建立 ${directMappings.length} 檔具直接營運關係的觀察標的。`
      : lane.beneficiaryLogic,
    dataGaps: gaps,
    validationSummary: validationSummary(outcomes),
  };
}
