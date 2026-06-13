import {
  generateTopicAiSummaryWithOpenAi,
  isOpenAiSummaryEnabled,
} from "@/lib/topic-ai-openai";

export type TopicAiInputArticle = {
  title: string;
  description?: string;
  sourceName: string;
};

export type TopicAiInput = {
  topicTitle: string;
  category: string;
  keywords: readonly string[];
  articles: TopicAiInputArticle[];
};

export type TopicAiOutput = {
  longTitle: string;
  summary: string;
  bullets: string[];
  subtopics: string[];
  tags: string[];
};

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function hasCjkText(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

function removeSourceSuffix(value: string) {
  return compactText(
    value
      .replace(/\s+-\s+[^-｜|]{2,30}$/g, "")
      .replace(/\s+\|\s+[^｜|]{2,30}$/g, "")
      .replace(/\s+[\u4e00-\u9fffA-Za-z0-9]+新聞網$/g, "")
  );
}

function neutralizeNewsText(value: string) {
  return compactText(
    value
      .replace(/&nbsp;/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/眼紅了？?/g, "")
      .replace(/震撼|驚人|驚爆|驚傳|嚇人/g, "引發關注")
      .replace(/狂！?|太狂了？?/g, "")
      .replace(/懶人包|一次看|一文看懂/g, "重點整理")
      .replace(/網喊|網友炸鍋|網全看傻/g, "引發網路討論")
      .replace(/掀熱議|引爆熱議/g, "引發討論")
      .replace(/買爆/g, "大量採購")
      .replace(/狂飆/g, "上升")
      .replace(/暴衝/g, "快速上升")
      .replace(/炸鍋/g, "引發討論")
      .replace(/嚇壞/g, "引發關注")
      .replace(/超猛/g, "表現突出")
      .replace(/搶下/g, "取得")
      .replace(/爆玄機/g, "引發關注")
      .replace(/嗆/g, "批評")
      .replace(/怒轟/g, "批評")
      .replace(/慘了/g, "受到影響")
      .replace(/驚：/g, "表示：")
      .replace(/！+/g, "。")
      .replace(/？+/g, "。")
  );
}

function removeMediaNoise(value: string) {
  return compactText(
    value
      .replace(/<ol>|<\/ol>|<li>|<\/li>|<a\b[^>]*>|<\/a>/gi, " ")
      .replace(/href="[^"]+"/gi, " ")
      .replace(/[（(]?\s*(中央社)?記者[^）)]{2,24}[）)]?/g, "")
      .replace(/[（(][^）)]{1,16}綜合外電報導[）)]/g, "")
      .replace(/^[^，。]{2,20}(台北|新北|桃園|高雄|台中|華盛頓|東京|北京|上海|首爾|紐約)\d*日電[）)]?/g, "")
      .replace(/^[^，。]{2,20}(台北|新北|桃園|高雄|台中|華盛頓|東京|北京|上海|首爾|紐約)\d*日綜合外電報導[）)]?/g, "")
      .replace(/^[^，。]{2,20}(台北|新北|桃園|高雄|台中|華盛頓|東京|北京|上海|首爾|紐約)[報導電]+/g, "")
      .replace(/\b(Yahoo|Google News|UDN|MSN|LINE TODAY|MoneyDJ)\b/gi, "")
      .replace(/\b(cnyes|Newtalk|PNN|Up Media)\b/gi, "")
      .replace(/Yahoo新聞|Yahoo股市|工商時報|自由財經|自由時報|中時新聞網|三立新聞網|鉅亨網|聯合新聞網|鏡新聞|中央社|公視新聞網|上報|TVBS新聞網|壹蘋新聞網|民視新聞網|ETtoday新聞雲/g, "")
      .replace(/\s+/g, " ")
  );
}

function stripHeadlinePrefix(value: string) {
  return compactText(
    value
      .replace(/^[【\[][^】\]]{1,18}[】\]]\s*/g, "")
      .replace(/^快訊[／/｜|:：-]?\s*/g, "")
      .replace(/^獨家[／/｜|:：-]?\s*/g, "")
      .replace(/^影[／/｜|:：-]?\s*/g, "")
      .replace(/^圖[／/｜|:：-]?\s*/g, "")
      .replace(/^新聞[／/｜|:：-]?\s*/g, "")
      .replace(/^重磅[／/｜|:：-]?\s*/g, "")
      .replace(/^獨／\s*/g, "")
      .replace(/^直擊[／/｜|:：-]?\s*/g, "")
      .replace(/^[^:：]{1,10}[：:]\s*/g, "")
  );
}

function normalizeSummaryText(value: string) {
  return removeMediaNoise(neutralizeNewsText(stripHeadlinePrefix(removeSourceSuffix(value))));
}

function isMostlyDuplicateText(value: string, reference: string) {
  const normalizedValue = compactText(removeSourceSuffix(value));
  const normalizedReference = compactText(removeSourceSuffix(reference));

  if (!normalizedValue || !normalizedReference) return false;
  if (normalizedValue === normalizedReference) return true;
  if (normalizedValue.startsWith(normalizedReference)) return true;

  const valueTokens = new Set(normalizedValue.split(""));
  const referenceTokens = new Set(normalizedReference.split(""));
  const overlap = [...valueTokens].filter((token) => referenceTokens.has(token)).length;
  const ratio = overlap / Math.max(1, Math.min(valueTokens.size, referenceTokens.size));

  return ratio > 0.88 && normalizedValue.length < normalizedReference.length + 30;
}

function inferQuickSummaryFromSignals(value: string) {
  if (/伊波拉|中非|疫情|確診|疫苗|cdc|who|廣效疫苗|公衛/i.test(value)) {
    return "中非伊波拉疫情與疫苗研發受到關注，重點在感染是否擴大、國際公衛單位如何示警，以及新疫苗能否降低後續風險。";
  }

  if (/南韓|韓國|投票|選舉|示威|李在明|尹錫悅|韓成淑|女總理|內閣|總理|制度|票/.test(value)) {
    return "南韓選舉與政局變化引發討論，焦點在投票制度、政黨力量變化，以及新政府人事與後續施政走向。";
  }

  if (/red bull|bc one|b-boy|b-girl|breaking|霹靂舞|許馥雅|舞者|台灣大賽/i.test(value)) {
    return "台灣霹靂舞賽事出現新焦點，重點在 BC One 台灣大賽結果、選手表現，以及街舞賽事能否延續討論熱度。";
  }

  if (/nba|林來瘋|林書豪|馬刺|紐約觀戰|總冠軍|籃球/i.test(value)) {
    return "NBA 討論聚焦林書豪回紐約觀戰與馬刺奪冠預測，重點在球迷記憶、球隊戰力判斷與後續賽季期待。";
  }

  if (/赴日旅遊|日本旅遊|男大生|失蹤|遺體|與母吵架/.test(value)) {
    return "日本旅遊失蹤事件受到關注，重點在失蹤經過、遺體尋獲與跨國旅遊安全提醒。";
  }

  if (/黃敏珊|madison huang|黃仁勳女兒|女兒|廚藝學校|教育理念|追尋所愛/i.test(value)) {
    return "這則來源聚焦黃仁勳家人的職涯選擇與教育觀，補充人物背景與外界對其家庭教育理念的討論。";
  }

  if (/英特爾|intel|特斯拉|tesla|terafab|台積電|tsmc/i.test(value) && /反殺|衝擊|競爭|晶圓廠|製程|合作/i.test(value)) {
    return "市場討論英特爾若與特斯拉晶圓廠合作，是否會影響台積電與先進製程競爭；目前仍多屬產業分析與情境推估。";
  }

  if (/英特爾|陳立武|台積電|張忠謀|魏哲家|合作關係|信賴的合作/i.test(value)) {
    return "英特爾表示將維持與台積電的合作關係，報導焦點在雙方供應鏈互動與先進製程合作是否延續。";
  }

  if (/h200|晶片管制|管制漏洞|解放軍|武器開發|算力/i.test(value)) {
    return "輝達 H200 晶片管制與算力取得問題受到關注，焦點在出口管制是否仍存在漏洞，以及相關技術可能帶來的安全風險。";
  }

  if (/貿聯|vera rubin|gb|ai平台升級|運算及運輸|逐季成長/i.test(value)) {
    return "貿聯看好下半年 AI 伺服器平台升級需求，市場關注 Vera Rubin 等新平台是否帶動連接線與供應鏈營運回升。";
  }

  if (/邁威爾|marvell|兆元企業|股價.*創新高/i.test(value)) {
    return "黃仁勳點名邁威爾的成長潛力後，市場關注 AI 基礎設施需求是否推動相關晶片與網通供應鏈升溫。";
  }

  if (/anthropic|openai最大對手|秘密遞交ipo|ipo申請/i.test(value)) {
    return "Anthropic 傳出準備 IPO，市場焦點在 AI 新創估值、資本市場熱度，以及 OpenAI 競爭格局的變化。";
  }

  if (/所羅門|人形機器人|實體ai|physical ai|自主化/i.test(value)) {
    return "所羅門整合輝達架構推進實體 AI 與人形機器人應用，焦點在機器人自主化與邊緣 AI 落地。";
  }

  if (/鴻海|亞灣|超算|代理ai|ai基建|ai基礎建設/i.test(value)) {
    return "鴻海與輝達合作推進 AI 基礎建設與超算應用，焦點在台灣 AI 基建、代理 AI 與資料中心需求。";
  }

  if (/大賣空|看空|網路泡沫|點名輝達.*泡沫|輝達.*泡沫/i.test(value)) {
    return "市場出現對輝達估值與 AI 題材過熱的疑慮，部分投資人把焦點放在是否重演科技泡沫風險。";
  }

  if (/n1x|pc戰場|聯發科|台積電|rtx spark|consumer laptop chips|computex/i.test(value)) {
    return "輝達在 Computex 期間延伸 PC 與 AI 晶片布局，台積電、聯發科與多家硬體夥伴成為市場關注焦點。";
  }

  if (
    /(黃仁勳|輝達|nvidia)/i.test(value) &&
    /背板股|概念股|漲停|台股|供應鏈|下單畫面/.test(value)
  ) {
    return "黃仁勳相關消息帶動台股與 AI 供應鏈討論，市場焦點集中在概念股、供應鏈名單與資金熱度。";
  }

  if (/(黃仁勳|輝達|nvidia).*(韓版|韓國|夥伴之夜|韓方|投資韓國)|(韓版|韓國|夥伴之夜|韓方|投資韓國).*(黃仁勳|輝達|nvidia)/i.test(value)) {
    return "黃仁勳韓國行程引發關注，報導聚焦 NVIDIA 與韓國科技供應鏈、投資合作和產業關係。";
  }

  if (/mlcc|被動元件|高盛|下一個記憶體|ai競賽/i.test(value)) {
    return "高盛與市場報告把部分被動元件視為 AI 伺服器供應鏈的新焦點，投資人正在關注報價、訂單與相關廠商獲利變化。";
  }

  if (/0050|成分股|換股|換血/i.test(value)) {
    return "市場正在關注 0050 成分股調整，相關概念股、傳產與金融股可能受到資金配置變化影響。";
  }

  if (/關稅|301調查|重建關稅壁壘|美擬對台徵|貿易談判/i.test(value)) {
    return "美方對台關稅與貿易談判成為焦點，重點在稅率是否調整、產業成本與後續協商進展。";
  }

  if (/南韓地方選舉|韓國地方選舉|尹錫悅|李在明|執政黨/i.test(value)) {
    return "南韓地方選舉結果牽動政局，焦點在執政黨表現、在野勢力消長與後續政策方向。";
  }

  if (/法網|梁恩碩|女雙|大滿貫|謝淑薇/i.test(value)) {
    return "法網女雙賽事傳出台灣選手進展，焦點在梁恩碩組合晉級表現與後續賽程。";
  }

  if (/中職|棒球|台鋼|味全|王維中|先發|延賽|澄清湖|龍鷹戰/i.test(value)) {
    return "中職賽事受雨勢影響出現延賽與先發調整，焦點在賽程安排、投手調度與球隊排名競爭。";
  }

  if (/強降雨|豪雨|西南風|熱帶低壓|降雨熱區|旱象/i.test(value)) {
    return "台灣降雨型態轉趨不穩，焦點在強降雨時程、中南部豪雨風險與防災準備。";
  }

  if (/t-34|教練機|飛官|墜毀|殉職|橋檢|相驗/i.test(value)) {
    return "T-34 教練機墜毀造成飛官殉職，報導焦點在事故調查、遺體相驗與後續飛安檢討。";
  }

  if (/火星|暖水|隕石坑|宜居|古隕石坑|古環境/.test(value)) {
    return "最新火星研究指出古代隕石坑可能曾有液態水環境，焦點在火星早期氣候、宜居條件與後續探測意義。";
  }

  if (/trump|executive order|ai models?|review|released|white house/i.test(value)) {
    return "美國政府擬檢視 AI 模型發布前的審查流程，焦點在模型安全、監管權限與科技公司產品上市節奏。";
  }

  if (/playstation|ps5|state of play|god of war|laufey|atlantis|trailer|gameplay/i.test(value)) {
    return "PlayStation 發表活動帶出多款遊戲消息，焦點在新作預告、上市時程與玩家社群反應。";
  }

  if (/電競選手|電競|後輩|浪費時間|職業選手|職涯/i.test(value)) {
    return "這則來源討論電競選手的職涯現實，焦點在職業門檻、收入與訓練壓力，以及年輕玩家投入職業賽道前需要理解的風險。";
  }

  if (/人型機器人|具身\s*ai|機器人平台|新漢|高通|computex/i.test(value)) {
    return "新漢與高通展示具身 AI 機器人平台，焦點在機器人量產、邊緣運算與實體 AI 應用落地。";
  }

  if (/黎巴嫩|以色列|真主黨|停火|美伊和談|美伊談判/.test(value)) {
    return "中東停火與美伊談判受到關注，焦點在以色列、黎巴嫩與伊朗相關表態是否影響後續區域局勢。";
  }

  if (/伊朗|美軍|革命衛隊|德黑蘭|美伊|科威特|軍事設施/.test(value)) {
    return "伊朗與美軍相關衝突升溫，報導焦點放在軍事行動、反擊說法，以及中東安全局勢是否進一步擴大。";
  }

  if (/(台美|anduril|非紅供應鏈|關鍵技術研發|國防科技).*(無人機|自主系統)|(無人機|自主系統).*(台美|anduril|非紅供應鏈|關鍵技術研發|國防科技)/i.test(value)) {
    return "台美無人機與自主系統合作升溫，焦點在 AI 自主技術、國防科技合作與非紅供應鏈建構。";
  }

  if (/普丁|澤倫斯基|俄烏|烏克蘭|俄羅斯|停火談判|和平談判|russia|ukraine/i.test(value)) {
    return "俄烏戰爭談判議題再受關注，焦點在俄方軍事推進、雙方會談條件與和平進程是否有實質進展。";
  }

  if (/遼寧艦|艦載機|航空母艦|起降|日本防衛省|小泉進次郎/i.test(value)) {
    return "中國航艦遼寧號在太平洋周邊活動引發日本關注，焦點在艦載機起降頻率與解放軍遠海作戰能力變化。";
  }

  if (/董軍|南非|中國國防部長|未出席重要場合|香格里拉/i.test(value)) {
    return "中國國防部長董軍行程引發外界關注，報導焦點在其公開露面、外交訪問與區域安全訊號。";
  }

  if (/松田康博|中國與台灣|吉野作造獎|讀賣/i.test(value)) {
    return "這則來源關注台海研究與相關著作獲獎，補充日本學界與媒體對中國、台灣議題的觀察。";
  }

  if (/台海|東海|中國海警|日菲|海域|執法巡查/.test(value)) {
    return "區域海域與執法爭議升溫，多方說法集中在主權、巡查行動與周邊安全情勢。";
  }

  if (/香格里拉|印太|美防長|國防|對台|習近平/.test(value)) {
    return "印太安全議題持續受到關注，美中台相關發言與國防政策成為多家媒體追蹤焦點。";
  }

  return "";
}

function inferTopicSummaryFromSignals(input: TopicAiInput, sourceNames: string[]) {
  const text = `${input.topicTitle} ${input.keywords.join(" ")} ${input.articles
    .map((article) => `${article.title} ${article.description ?? ""}`)
    .join(" ")}`;
  const sourceText = sourceNames.length ? `，目前由 ${sourceNames.join("、")} 等來源追蹤` : "";

  if (/0050|成分股|換股|換血/i.test(text)) {
    return `0050 成分股調整進入市場關注期，焦點在可能納入或剔除的個股，以及 ETF 資金配置變動對 AI 概念股、傳產與金融股的影響${sourceText}。`;
  }

  if (/關稅|301調查|美擬對台徵|貿易談判|重建關稅壁壘/i.test(text)) {
    return `美國對台關稅與貿易談判成為今日政策焦點，報導集中在可能稅率、台灣相對優勢、產業成本與政府後續協商${sourceText}。`;
  }

  if (/南韓地方選舉|韓國地方選舉|尹錫悅|李在明|執政黨/i.test(text)) {
    return `南韓地方選舉牽動政局變化，報導焦點在執政黨選情、在野陣營動員，以及選後對政府施政與國會互動的影響${sourceText}。`;
  }

  if (/南韓|韓國|投票|選舉|示威|李在明|尹錫悅|韓成淑|女總理|內閣|總理/i.test(text)) {
    return `南韓政治與選舉消息成為今日焦點，報導集中在投票制度、政黨力量變化、新政府人事與後續政策走向${sourceText}。`;
  }

  if (/伊波拉|中非|疫情|確診|疫苗|cdc|who|廣效疫苗|公衛/i.test(text)) {
    return `公衛疫情與疫苗研發受到關注，報導集中在中非伊波拉疫情是否擴大、國際公衛單位示警，以及疫苗研發能否降低後續風險${sourceText}。`;
  }

  if (/red bull|bc one|b-boy|b-girl|breaking|霹靂舞|許馥雅|舞者|台灣大賽/i.test(text)) {
    return `台灣霹靂舞賽事成為體育與街舞圈焦點，報導集中在 BC One 台灣大賽結果、選手表現與後續國際賽事機會${sourceText}。`;
  }

  if (/nba|林來瘋|林書豪|馬刺|紐約觀戰|總冠軍|籃球/i.test(text)) {
    return `NBA 討論聚焦林書豪回紐約觀戰與馬刺奪冠預測，報導集中在球迷記憶、球隊戰力判斷與後續賽季期待${sourceText}。`;
  }

  if (/赴日旅遊|日本旅遊|男大生|失蹤|遺體|與母吵架/.test(text)) {
    return `日本旅遊失蹤事件受到關注，報導集中在失蹤經過、遺體尋獲、家屬說法與跨國旅遊安全提醒${sourceText}。`;
  }

  if (/法網|梁恩碩|女雙|大滿貫|謝淑薇/i.test(text)) {
    return `法網女雙賽事出現台灣選手焦點，報導集中在梁恩碩組合晉級表現、台將紀錄與後續賽程安排${sourceText}。`;
  }

  if (/中職|棒球|台鋼|味全|王維中|先發|延賽|澄清湖|龍鷹戰/i.test(text)) {
    return `中職賽事受到雨勢影響，報導集中在比賽延賽、先發投手調整、台鋼與味全排名競爭，以及後續補賽安排${sourceText}。`;
  }

  if (/強降雨|豪雨|西南風|熱帶低壓|降雨熱區|旱象/i.test(text)) {
    return `台灣天氣轉趨不穩，報導聚焦強降雨時程、中南部豪雨風險、低壓帶與西南風變化，以及民眾防災準備${sourceText}。`;
  }

  if (/t-34|教練機|飛官|墜毀|殉職|橋檢|相驗/i.test(text)) {
    return `T-34 教練機墜毀事故受到多家媒體追蹤，焦點集中在飛官殉職、事故原因調查、相驗程序與後續飛安檢討${sourceText}。`;
  }

  if (/火星|暖水|隕石坑|宜居|古環境/.test(text)) {
    return `火星古環境研究出現新線索，科學報導聚焦古代液態水、隕石坑地質與火星是否曾具備宜居條件${sourceText}。`;
  }

  if (/trump|executive order|ai models?|review|released|white house/i.test(text)) {
    return `美國 AI 模型審查政策成為科技與監管焦點，報導集中在白宮行政命令、模型發布前檢視、安全風險與企業合規壓力${sourceText}。`;
  }

  if (/playstation|ps5|state of play|god of war|laufey|atlantis|trailer|gameplay/i.test(text)) {
    return `PlayStation 遊戲發表活動帶出多款新作與預告消息，報導聚焦 State of Play 發表內容、重點遊戲、上市時程與玩家期待${sourceText}。`;
  }

  if (/電競選手|電競|後輩|浪費時間|職業選手|職涯/i.test(text)) {
    return `電競選手職涯現實引發討論，報導焦點在職業門檻、訓練成本、收入不確定性，以及年輕玩家投入前需要理解的風險${sourceText}。`;
  }

  if (/人型機器人|具身\s*ai|機器人平台|新漢|高通|computex/i.test(text)) {
    return `具身 AI 機器人平台成為 Computex 期間的產業焦點，報導聚焦人型機器人量產瓶頸、邊緣 AI 運算、硬體整合與實際應用落地${sourceText}。`;
  }

  if (/英特爾|intel|特斯拉|tesla|terafab|台積電|tsmc/i.test(text) && /反殺|衝擊|競爭|晶圓廠|製程|合作/i.test(text)) {
    return `英特爾、特斯拉與台積電競爭討論受到科技媒體關注，重點在晶圓廠合作想像、先進製程能力與台積電競爭位置是否會受影響${sourceText}。`;
  }

  if (/黎巴嫩|以色列|真主黨|停火|美伊和談|美伊談判/.test(text)) {
    return `中東停火與美伊談判相關消息升溫，報導焦點集中在以色列、黎巴嫩、伊朗與美方斡旋之間的互動，以及局勢是否會進一步擴大${sourceText}。`;
  }

  if (/伊朗|美軍|革命衛隊|德黑蘭|中東/.test(text)) {
    return `伊朗與美軍相關衝突升溫，多家媒體聚焦軍事行動、反擊說法與中東安全情勢後續變化${sourceText}。`;
  }

  if (/普丁|澤倫斯基|俄烏|烏克蘭|俄羅斯|停火談判|和平談判|russia|ukraine/i.test(text)) {
    return `俄烏戰爭與和平談判重新成為國際焦點，報導集中在俄軍推進、雙方會談條件、停火可能性與外交斡旋進度${sourceText}。`;
  }

  if (/東海|台灣以東|中國海警|日菲|執法巡查|海域/.test(text)) {
    return `東海與台海周邊海域議題升溫，報導焦點集中在海域主張、執法巡查與周邊國家互動，後續可能牽動區域安全討論${sourceText}。`;
  }

  if (/美防長|香格里拉|印太|對台|台海|美中/.test(text)) {
    return `美中台海安全論述持續發酵，焦點在美方對台政策表述、印太安全架構，以及相關發言可能造成的外交與安全解讀${sourceText}。`;
  }

  if (/mlcc|被動元件|高盛|下一個記憶體|ai競賽|伺服器/i.test(text)) {
    return `AI 伺服器供應鏈出現新的市場焦點，報導集中在被動元件、報價循環與相關廠商獲利想像，投資人正在觀察訂單與產業趨勢是否延續${sourceText}。`;
  }

  return "";
}

function inferSubtopicsFromSignals(input: TopicAiInput) {
  const text = `${input.topicTitle} ${input.keywords.join(" ")} ${input.articles
    .map((article) => `${article.title} ${article.description ?? ""}`)
    .join(" ")}`;

  if (input.topicTitle === "AI" || /人工智慧|生成式 ai|openai|輝達|nvidia|資料中心|機器人/i.test(text)) {
    const branches = [
      /openai|anthropic|模型|生成式|agent|代理ai/i.test(text) ? "模型與產品" : "",
      /輝達|nvidia|gpu|晶片|半導體|伺服器|資料中心/i.test(text) ? "晶片與基礎建設" : "",
      /機器人|自動化|實體ai|physical ai/i.test(text) ? "機器人與應用" : "",
      /供應鏈|台積電|聯發科|記憶體|散熱|hbm/i.test(text) ? "供應鏈動態" : "",
    ];

    return uniqueStrings(branches).slice(0, 4);
  }

  if (/t-34|教練機|飛官|墜毀|殉職/i.test(text)) {
    return ["事故經過", "人員傷亡", "調查進度", "飛安檢討"];
  }

  if (/0050|成分股|換股|換血/i.test(text)) {
    return ["成分股變動", "ETF 資金配置", "受影響產業", "後續觀察"];
  }

  if (/中職|棒球|台鋼|味全|王維中|先發|延賽|澄清湖|龍鷹戰/i.test(text)) {
    return ["雨勢延賽", "先發調整", "補賽安排", "排名競爭"];
  }

  if (/伊波拉|中非|疫情|確診|疫苗|cdc|who|公衛/i.test(text)) {
    return ["疫情擴散", "國際示警", "疫苗研發", "防疫觀察"];
  }

  if (/南韓|韓國|投票|選舉|李在明|尹錫悅|韓成淑|內閣|總理/i.test(text)) {
    return ["選舉制度", "政黨變化", "新政府人事", "政策走向"];
  }

  if (/red bull|bc one|b-boy|b-girl|breaking|霹靂舞|許馥雅|台灣大賽/i.test(text)) {
    return ["台灣大賽", "選手表現", "街舞賽事", "國際舞台"];
  }

  if (/nba|林來瘋|林書豪|馬刺|紐約觀戰|總冠軍|籃球/i.test(text)) {
    return ["球迷記憶", "馬刺戰力", "賽季預測", "NBA 討論"];
  }

  if (/赴日旅遊|日本旅遊|男大生|失蹤|遺體|與母吵架/.test(text)) {
    return ["失蹤經過", "遺體尋獲", "家屬說法", "旅遊安全"];
  }

  if (/trump|executive order|ai models?|review|released|white house/i.test(text)) {
    return ["行政命令", "模型安全", "企業合規", "發布審查"];
  }

  if (/playstation|ps5|state of play|god of war|laufey|atlantis|trailer|gameplay/i.test(text)) {
    return ["發表活動", "新作預告", "上市時程", "玩家反應"];
  }

  if (/英特爾|intel|特斯拉|tesla|terafab|台積電|tsmc/i.test(text)) {
    return ["晶圓廠合作", "先進製程", "台積電競爭", "產業分析"];
  }

  if (/電競選手|電競|後輩|浪費時間|職業選手|職涯/i.test(text)) {
    return ["職業門檻", "訓練成本", "收入風險", "年輕玩家選擇"];
  }

  if (/人型機器人|具身\s*ai|機器人平台|新漢|高通|computex/i.test(text)) {
    return ["人型機器人", "邊緣 AI", "硬體平台", "量產瓶頸"];
  }

  if (/普丁|澤倫斯基|俄烏|烏克蘭|俄羅斯|停火談判|和平談判/i.test(text)) {
    return ["前線戰況", "會談條件", "停火可能", "國際斡旋"];
  }

  if (/台海|印太|美防長|對台|美中/i.test(text)) {
    return ["美方表態", "台海安全", "印太局勢", "後續外交解讀"];
  }

  return [];
}

function trimToSentence(value: string, maxLength: number) {
  const text = compactText(value);
  if (text.length <= maxLength) return text;

  const sentenceEnd = text.slice(0, maxLength).search(/[。！？.!?](?=[^。！？.!?]*$)/);
  if (sentenceEnd > 40) {
    return text.slice(0, sentenceEnd + 1);
  }

  return `${text.slice(0, maxLength).trim()}...`;
}

function summarizeEnglishSource(title: string) {
  const lowerTitle = title.toLowerCase();

  if (/computex|nvidia|rtx|spark|chip|laptop|pc/.test(lowerTitle)) {
    return "英文來源補充了 Computex、NVIDIA 晶片與裝置新品相關動態，可作為本主題的國際科技背景。";
  }

  return "這篇英文來源補充了本主題的國際背景，系統目前先保留為延伸閱讀來源。";
}

function summarizeTitleAsEvent(title: string) {
  const cleanedTitle = normalizeSummaryText(title);

  if (!cleanedTitle) return "";
  if (!hasCjkText(cleanedTitle)) return summarizeEnglishSource(cleanedTitle);

  const eventText = cleanedTitle
    .replace(/^\W+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (eventText.length < 10) return "";

  return trimToSentence(`${eventText}。`, 96);
}

export function generateArticleQuickSummary(article: TopicAiInputArticle) {
  const title = normalizeSummaryText(article.title);
  const description = normalizeSummaryText(article.description ?? "");
  const inferredSummary = inferQuickSummaryFromSignals(`${title} ${description}`);

  if (inferredSummary) {
    return inferredSummary;
  }

  if (description && !isMostlyDuplicateText(description, title)) {
    const withoutDuplicateTitle = description.startsWith(title)
      ? compactText(description.slice(title.length))
      : description;
    const cleanedDescription = normalizeSummaryText(withoutDuplicateTitle);

    if (cleanedDescription && cleanedDescription.length > 16) {
      if (!hasCjkText(cleanedDescription)) {
        return summarizeEnglishSource(title);
      }

      return trimToSentence(cleanedDescription, 120);
    }
  }

  const titleSummary = summarizeTitleAsEvent(title);
  if (titleSummary) {
    return titleSummary;
  }

  return summarizeEnglishSource(title);
}

export async function generateTopicAiSummary(
  input: TopicAiInput
): Promise<TopicAiOutput> {
  if (isOpenAiSummaryEnabled()) {
    try {
      return await generateTopicAiSummaryWithOpenAi(input);
    } catch (error) {
      console.warn("[topic-ai] OpenAI summary failed, falling back to rule-based", {
        topicTitle: input.topicTitle,
        error: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const sourceNames = uniqueStrings(input.articles.map((article) => article.sourceName));

  const longTitle = `${input.topicTitle}成今日熱門焦點`;

  const inferredSummary = inferTopicSummaryFromSignals(input, sourceNames);
  const summary =
    inferredSummary ||
    `目前「${input.topicTitle}」相關報導已整合 ${input.articles.length} 則來源，系統先以去重後事件整理重點；後續同步會依新增來源更新脈絡。`;

  const articleSummaries = uniqueStrings(
    input.articles
      .map((article) => generateArticleQuickSummary(article))
      .filter((summaryItem) => hasCjkText(summaryItem))
  ).slice(0, 4);

  const bullets =
    articleSummaries.length > 0
      ? articleSummaries
      : [
          `多家來源正在報導「${input.topicTitle}」的最新發展。`,
          "目前資訊仍在累積，後續同步會持續更新事件脈絡。",
        ];

  const inferredSubtopics = inferSubtopicsFromSignals(input);
  const subtopics = inferredSubtopics.length
    ? inferredSubtopics
    : input.keywords.slice(0, 4).map((item) => item);
  const tags = input.keywords.slice(0, 4).map((item) => item);

  return {
    longTitle,
    summary,
    bullets,
    subtopics,
    tags,
  };
}
