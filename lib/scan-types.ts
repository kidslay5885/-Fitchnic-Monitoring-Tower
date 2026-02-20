import type { MonitoringItem } from "@/lib/types";

export type ProviderStatus = {
  id: string;             // "google_web" | "naver_cafe" | ...
  label: string;          // "Google(웹)" | "네이버(카페글)" ...
  ok: boolean;
  count: number;
  checkedAt: string;      // ISO
  error?: string;
};

export type ScoredItem = MonitoringItem & {
  riskScore?: number;
  riskLevel?: "LOW" | "MED" | "HIGH";
  isNew?: boolean;
  isTargetCafeHit?: boolean;
  reasons?: string[];
};

export type ScanReport = {
  generatedAt: string;
  keywords: string[];
  statuses: ProviderStatus[];
  items: ScoredItem[];
};
