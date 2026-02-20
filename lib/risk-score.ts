import type { MonitoringItem } from "@/lib/types";

const ATTACK_WORDS = [
  "사기", "먹튀", "피해", "고소", "신고", "절대", "최악", "조작", "구라", "환불 안",
  "하지마", "거르", "망", "논란",
];

const INQUIRY_WORDS = [
  "문의", "알려", "방법", "되나요", "가능", "규정", "절차", "질문",
];

export type RiskResult = {
  score: number;        // 0~100
  level: "LOW" | "MED" | "HIGH";
  reasons: string[];
  isTargetCafeHit: boolean;
};

export function scoreRisk(
  item: Pick<MonitoringItem, "title" | "content" | "author" | "link">,
  opts: { targetCafeUrls?: string[] } = {}
): RiskResult {
  const text = `${item.title}\n${item.content}`.toLowerCase();

  let score = 10;
  const reasons: string[] = [];

  // 공격 단어 가중
  for (const w of ATTACK_WORDS) {
    if (text.includes(w.toLowerCase())) {
      score += 15;
      reasons.push(`attack_word:${w}`);
    }
  }

  // 문의성(노이즈) 감점
  for (const w of INQUIRY_WORDS) {
    if (text.includes(w.toLowerCase())) {
      score -= 8;
      reasons.push(`inquiry_word:${w}`);
    }
  }

  // 타겟 카페면 무조건 가중 (업무 목적상 중요)
  const targetCafeUrls = opts.targetCafeUrls || [];
  const isTargetCafeHit = targetCafeUrls.some((u) => item.link?.includes(u));
  if (isTargetCafeHit) {
    score += 35;
    reasons.push("target_cafe");
  }

  score = Math.max(0, Math.min(100, score));

  const level: RiskResult["level"] =
    score >= 70 ? "HIGH" : score >= 40 ? "MED" : "LOW";

  return { score, level, reasons, isTargetCafeHit };
}
