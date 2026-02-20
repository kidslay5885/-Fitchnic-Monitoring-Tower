export type QueryPack = {
  id: string;
  label: string;
  makeQueries: (brand: string) => string[];
};

// Risk modifiers for detecting hostile/attack content
export const RISK_MODIFIERS = [
  "환불", "사기", "먹튀", "피해", "후기", "논란", "불만", "민원", "고소", "신고",
  "최악", "절대", "하지마", "비추", "거르", "조작", "구라",
];

// Google(SerpAPI): OR operator for single-query risk sweep
export function buildGoogleRiskQuery(brand: string): string {
  const or = RISK_MODIFIERS.map((w) => `"${w}"`).join(" OR ");
  return `"${brand}" (${or})`;
}

// Google social site-scoped queries
export function buildSocialQueries(brand: string): string[] {
  return [
    `site:instagram.com "${brand}"`,
    `site:threads.net "${brand}" OR site:threads.com "${brand}"`,
  ];
}

// Naver: separate calls because OR is unreliable
export function buildNaverQueries(brand: string): string[] {
  const topRisk = ["환불", "사기", "피해", "논란"];
  return [
    `"${brand}"`,
    ...topRisk.map((w) => `"${brand}" "${w}"`),
  ];
}

// All-in-one pack for unified scan
export const QUERY_PACKS: QueryPack[] = [
  {
    id: "brand-basic",
    label: "브랜드 기본",
    makeQueries: (brand) => [`"${brand}"`],
  },
  {
    id: "brand-risk",
    label: "공격 탐지",
    makeQueries: (brand) => {
      const topRisk = ["환불", "사기", "먹튀", "피해", "논란", "신고"];
      return topRisk.map((w) => `"${brand}" "${w}"`);
    },
  },
  {
    id: "brand-social",
    label: "소셜 탐지",
    makeQueries: (brand) => buildSocialQueries(brand),
  },
];
