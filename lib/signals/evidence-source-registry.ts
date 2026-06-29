export type EvidenceCategory =
  | "news"
  | "industry"
  | "commodity"
  | "company"
  | "supply_chain"
  | "market";

export type SignalFamily =
  | "memory"
  | "ai_compute"
  | "ai_power_grid"
  | "ai_cooling"
  | "advanced_packaging"
  | "optical_networking";

export type EvidenceRequirement = {
  key: string;
  category: EvidenceCategory;
  label: string;
  priority: "required" | "recommended";
  minItems: number;
  acceptedSourceTypes: string[];
  examples: string[];
};

export type EvidenceFamilySpec = {
  family: SignalFamily;
  label: string;
  matchers: RegExp[];
  requirements: EvidenceRequirement[];
};

export type EvidenceLike = {
  sourceType?: string;
  title?: string;
  summary?: string;
  sourceName?: string;
};

export const evidenceFamilySpecs: EvidenceFamilySpec[] = [
  {
    family: "memory",
    label: "Memory / HBM / DRAM",
    matchers: [/memory|dram|nand|hbm|記憶體|內存/i],
    requirements: [
      {
        key: "memory_pricing",
        category: "commodity",
        label: "DRAM / NAND / HBM 報價或合約價",
        priority: "required",
        minItems: 1,
        acceptedSourceTypes: ["commodity", "price", "industry"],
        examples: ["DRAM contract price", "NAND spot price", "HBM supply pricing"],
      },
      {
        key: "memory_supply",
        category: "industry",
        label: "產能、庫存、稼動率或供需資料",
        priority: "required",
        minItems: 1,
        acceptedSourceTypes: ["industry", "supply_chain", "official"],
        examples: ["inventory days", "capacity utilization", "bit shipment"],
      },
    ],
  },
  {
    family: "ai_compute",
    label: "AI Compute / AI Server",
    matchers: [/ai server|ai\s*資料中心|ai\s*伺服器|gpu|accelerator|算力|ai 晶片|ai晶片/i],
    requirements: [
      {
        key: "compute_shipments",
        category: "industry",
        label: "AI Server / GPU / accelerator 出貨或需求資料",
        priority: "required",
        minItems: 1,
        acceptedSourceTypes: ["industry", "supply_chain", "official"],
        examples: ["AI server shipment", "GPU shipment", "accelerator demand"],
      },
      {
        key: "cloud_capex",
        category: "company",
        label: "雲端業者資本支出或資料中心建置資訊",
        priority: "recommended",
        minItems: 1,
        acceptedSourceTypes: ["company_action", "filing", "official"],
        examples: ["hyperscaler capex", "data center expansion", "cloud infrastructure guidance"],
      },
    ],
  },
  {
    family: "ai_power_grid",
    label: "AI Power / Grid",
    matchers: [/ai power|data center power|power infrastructure|電力|電網|變壓器|grid|transformer/i],
    requirements: [
      {
        key: "power_grid_equipment",
        category: "industry",
        label: "電網設備、變壓器、輸配電或交期資料",
        priority: "required",
        minItems: 1,
        acceptedSourceTypes: ["industry", "official", "supply_chain"],
        examples: ["transformer PPI", "grid equipment lead time", "utility capex"],
      },
      {
        key: "power_demand",
        category: "industry",
        label: "資料中心用電、電力需求或能源負載資料",
        priority: "required",
        minItems: 1,
        acceptedSourceTypes: ["industry", "official", "commodity"],
        examples: ["data center electricity demand", "power load forecast", "energy demand"],
      },
    ],
  },
  {
    family: "ai_cooling",
    label: "AI Cooling / Thermal",
    matchers: [/cooling|liquid cooling|thermal|散熱|液冷|熱管理/i],
    requirements: [
      {
        key: "cooling_adoption",
        category: "industry",
        label: "液冷滲透率、機櫃功率密度或熱管理需求",
        priority: "required",
        minItems: 1,
        acceptedSourceTypes: ["industry", "supply_chain", "official"],
        examples: ["liquid cooling adoption", "rack density", "thermal design power"],
      },
    ],
  },
  {
    family: "advanced_packaging",
    label: "CoWoS / Advanced Packaging",
    matchers: [/cowos|advanced packaging|先進封裝|封裝|copo?s/i],
    requirements: [
      {
        key: "packaging_capacity",
        category: "industry",
        label: "先進封裝產能、交期、稼動率或擴產資料",
        priority: "required",
        minItems: 1,
        acceptedSourceTypes: ["industry", "supply_chain", "official"],
        examples: ["CoWoS capacity", "advanced packaging utilization", "packaging lead time"],
      },
    ],
  },
  {
    family: "optical_networking",
    label: "Optical Networking / CPO",
    matchers: [/cpo|co-packaged optics|silicon photonics|optical|光通訊|矽光子|800g|1\.6t/i],
    requirements: [
      {
        key: "optical_shipments",
        category: "industry",
        label: "高速光模組、交換器或矽光子出貨資料",
        priority: "required",
        minItems: 1,
        acceptedSourceTypes: ["industry", "supply_chain", "official"],
        examples: ["800G shipment", "1.6T optics", "silicon photonics adoption"],
      },
    ],
  },
];

function normalized(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectSignalFamilies(input: { topic: string; hypothesis?: string }) {
  const text = normalized(`${input.topic} ${input.hypothesis ?? ""}`);
  return evidenceFamilySpecs
    .filter((spec) => spec.matchers.some((matcher) => matcher.test(text)))
    .map((spec) => spec.family);
}

export function getEvidenceRequirementsForSignal(input: { topic: string; hypothesis?: string }) {
  const families = detectSignalFamilies(input);
  const requirements = evidenceFamilySpecs
    .filter((spec) => families.includes(spec.family))
    .flatMap((spec) => spec.requirements);

  return { families, requirements };
}

function sourceTypeMatches(requirement: EvidenceRequirement, evidence: EvidenceLike) {
  const sourceType = normalized(evidence.sourceType ?? "");
  const text = normalized(`${evidence.title ?? ""} ${evidence.summary ?? ""} ${evidence.sourceName ?? ""}`);
  const acceptedType = requirement.acceptedSourceTypes.some((type) => sourceType === type || sourceType.includes(type));
  const matchedExample = requirement.examples.some((example) => text.includes(normalized(example)));

  return acceptedType && matchedExample;
}

export function assessEvidenceCoverage(input: {
  topic: string;
  hypothesis?: string;
  evidenceItems: EvidenceLike[];
}) {
  const { families, requirements } = getEvidenceRequirementsForSignal(input);
  const required = requirements.map((requirement) => {
    const currentItems = input.evidenceItems.filter((evidence) => sourceTypeMatches(requirement, evidence)).length;
    return {
      ...requirement,
      currentItems,
      satisfied: currentItems >= requirement.minItems,
    };
  });
  const requiredOnly = required.filter((item) => item.priority === "required");

  return {
    families,
    required,
    missingRequired: requiredOnly.filter((item) => !item.satisfied),
    satisfiedRequiredCount: requiredOnly.filter((item) => item.satisfied).length,
    totalRequiredCount: requiredOnly.length,
  };
}
