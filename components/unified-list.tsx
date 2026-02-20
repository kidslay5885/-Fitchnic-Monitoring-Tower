"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, AlertTriangle, Flag, LayoutList } from "lucide-react";
import type {
  MonitoringItem,
  PlatformSource,
  MonitoringType,
} from "@/lib/types";

interface UnifiedListProps {
  items: MonitoringItem[];
  negativeKeywords: string[];
}

/* ------------------------------------------------------------------ */
/*  Platform icon – small coloured indicator next to each row          */
/* ------------------------------------------------------------------ */
function PlatformIcon({ source }: { source: PlatformSource }) {
  switch (source) {
    case "youtube":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded bg-[#FF0000]/15">
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3"
            fill="#FF0000"
            aria-hidden="true"
          >
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.9 31.9 0 0 0 0 12a31.9 31.9 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-5.8.5-5.8s0-3.9-.5-5.8ZM9.8 15.5V8.5l6.2 3.5-6.2 3.5Z" />
          </svg>
        </span>
      );
    case "naver":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded bg-[#03C75A]/15">
          <span className="text-[9px] font-extrabold leading-none text-[#03C75A]">
            N
          </span>
        </span>
      );
    case "google":
      return (
        <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/15">
          <svg
            viewBox="0 0 24 24"
            className="h-3 w-3"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.1a6.93 6.93 0 0 1 0-4.19V7.07H2.18A11.97 11.97 0 0 0 1 12c0 1.78.4 3.48 1.18 5.02l3.66-2.93Z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
              fill="#EA4335"
            />
          </svg>
        </span>
      );
  }
}

/* ------------------------------------------------------------------ */
/*  Type label – sub-category badge                                    */
/* ------------------------------------------------------------------ */
const typeLabels: Record<MonitoringType, string> = {
  comment: "댓글",
  blog: "블로그",
  cafe: "카페",
  web: "웹",
  news: "뉴스",
  general: "일반",
};

const platformLabels: Record<PlatformSource, string> = {
  youtube: "YouTube",
  naver: "Naver",
  google: "Google",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function matchesNegativeKeywords(
  text: string,
  keywords: string[]
): string | null {
  const lower = text.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw.toLowerCase())) {
      return kw;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function UnifiedList({ items, negativeKeywords }: UnifiedListProps) {
  // URL-based deduplication at display time, sorted newest first
  const dedupedItems = useMemo(() => {
    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      const key = item.link;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    deduped.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    return deduped;
  }, [items]);

  // Per-platform counts
  const counts = useMemo(() => {
    const map: Record<PlatformSource, number> = {
      youtube: 0,
      naver: 0,
      google: 0,
    };
    for (const item of dedupedItems) {
      map[item.source]++;
    }
    return map;
  }, [dedupedItems]);

  const flaggedCount = dedupedItems.filter(
    (item) =>
      matchesNegativeKeywords(item.content, negativeKeywords) !== null ||
      matchesNegativeKeywords(item.title, negativeKeywords) !== null
  ).length;

  if (dedupedItems.length === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <LayoutList className="h-10 w-10 text-muted-foreground/40" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-muted-foreground">
                수집된 데이터가 없습니다
              </p>
              <p className="text-xs text-muted-foreground/70">
                각 플랫폼 탭에서 데이터를 수집하면 여기에 통합되어 표시됩니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-lg text-card-foreground">
            통합 모니터링 ({dedupedItems.length.toLocaleString()}건)
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Per-platform counts */}
            {counts.youtube > 0 && (
              <Badge
                variant="secondary"
                className="gap-1 text-xs bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/20"
              >
                <PlatformIcon source="youtube" />
                {counts.youtube}
              </Badge>
            )}
            {counts.naver > 0 && (
              <Badge
                variant="secondary"
                className="gap-1 text-xs bg-[#03C75A]/10 text-[#03C75A] border-[#03C75A]/20"
              >
                <PlatformIcon source="naver" />
                {counts.naver}
              </Badge>
            )}
            {counts.google > 0 && (
              <Badge
                variant="secondary"
                className="gap-1 text-xs bg-primary/10 text-primary border-primary/20"
              >
                <PlatformIcon source="google" />
                {counts.google}
              </Badge>
            )}
            {flaggedCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                위험 {flaggedCount}건
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border overflow-auto max-h-[600px]">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground w-[120px]">
                  출처
                </TableHead>
                <TableHead className="text-muted-foreground w-[200px]">
                  제목
                </TableHead>
                <TableHead className="text-muted-foreground">내용</TableHead>
                <TableHead className="text-muted-foreground w-[110px]">
                  작성자
                </TableHead>
                <TableHead className="text-muted-foreground w-[100px]">
                  작성일
                </TableHead>
                <TableHead className="text-muted-foreground w-[90px] text-center">
                  액션
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dedupedItems.map((item) => {
                const matchedKw =
                  matchesNegativeKeywords(item.content, negativeKeywords) ||
                  matchesNegativeKeywords(item.title, negativeKeywords);
                const isFlagged = matchedKw !== null;

                return (
                  <TableRow
                    key={`${item.source}-${item.id}`}
                    className={`border-border ${
                      isFlagged
                        ? "bg-destructive/5 hover:bg-destructive/10"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    {/* Platform + Type */}
                    <TableCell className="align-top">
                      <div className="flex items-center gap-1.5">
                        <PlatformIcon source={item.source} />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-foreground leading-none">
                            {platformLabels[item.source]}
                          </span>
                          <span className="text-[10px] text-muted-foreground leading-none">
                            {typeLabels[item.type] ?? item.type}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Title */}
                    <TableCell className="text-sm font-medium text-foreground align-top">
                      <span className="line-clamp-2">{item.title}</span>
                    </TableCell>

                    {/* Content */}
                    <TableCell className="text-sm text-secondary-foreground align-top">
                      <div className="flex flex-col gap-1">
                        <span className="line-clamp-2 max-w-[350px]">
                          {item.content}
                        </span>
                        {isFlagged && (
                          <Badge
                            variant="destructive"
                            className="self-start text-[10px] gap-1"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {matchedKw}
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {/* Author */}
                    <TableCell className="text-sm text-muted-foreground align-top">
                      {item.authorUrl ? (
                        <a
                          href={item.authorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="max-w-[110px] truncate block hover:text-foreground transition-colors"
                        >
                          {item.author}
                        </a>
                      ) : (
                        <span className="max-w-[110px] truncate block">
                          {item.author}
                        </span>
                      )}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="text-xs text-muted-foreground align-top">
                      {formatDate(item.publishedAt)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-center align-top">
                      <div className="flex items-center justify-center gap-1">
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="원본 보기"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                        {isFlagged && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                            title="신고"
                          >
                            <Flag className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
