"use client";

import React from "react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Clock,
} from "lucide-react";
import type {
  MonitoringItem,
  PlatformSource,
  MonitoringType,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Source badge helper                                                 */
/* ------------------------------------------------------------------ */
const SOCIAL_DOMAINS: Record<string, { label: string; color: string }> = {
  "threads.net": { label: "Threads", color: "bg-gray-100 text-gray-700 border-gray-300" },
  "threads.com": { label: "Threads", color: "bg-gray-100 text-gray-700 border-gray-300" },
  "instagram.com": { label: "Instagram", color: "bg-pink-50 text-pink-700 border-pink-200" },
  "twitter.com": { label: "X/Twitter", color: "bg-blue-50 text-blue-700 border-blue-200" },
  "x.com": { label: "X/Twitter", color: "bg-blue-50 text-blue-700 border-blue-200" },
  "facebook.com": { label: "Facebook", color: "bg-blue-50 text-blue-700 border-blue-200" },
  "reddit.com": { label: "Reddit", color: "bg-orange-50 text-orange-700 border-orange-200" },
  "tiktok.com": { label: "TikTok", color: "bg-gray-100 text-gray-700 border-gray-300" },
  "youtube.com": { label: "YouTube", color: "bg-red-50 text-red-700 border-red-200" },
  "blog.naver.com": { label: "네이버 블로그", color: "bg-green-50 text-green-700 border-green-200" },
  "cafe.naver.com": { label: "네이버 카페", color: "bg-green-50 text-green-700 border-green-200" },
};

function getSourceBadge(link: string): { label: string; color: string } | null {
  try {
    const hostname = new URL(link).hostname.replace(/^www\./, "");
    if (SOCIAL_DOMAINS[hostname]) return SOCIAL_DOMAINS[hostname];
    const parts = hostname.split(".");
    if (parts.length > 2) {
      const parent = parts.slice(-2).join(".");
      if (SOCIAL_DOMAINS[parent]) return SOCIAL_DOMAINS[parent];
    }
    return null;
  } catch {
    return null;
  }
}

function getDomain(link: string): string {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Platform Icons                                                      */
/* ------------------------------------------------------------------ */
function PlatformIcon({ source, type }: { source: PlatformSource; type?: string }) {
  if (source === "youtube") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FF0000]/10">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#FF0000" aria-hidden="true">
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.9 31.9 0 0 0 0 12a31.9 31.9 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-5.8.5-5.8s0-3.9-.5-5.8ZM9.8 15.5V8.5l6.2 3.5-6.2 3.5Z" />
        </svg>
      </span>
    );
  }
  if (source === "naver" && type === "cafe") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#795C34]/10">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="#795C34" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" /><line x1="6" x2="6" y1="2" y2="4" /><line x1="10" x2="10" y1="2" y2="4" /><line x1="14" x2="14" y1="2" y2="4" />
        </svg>
      </span>
    );
  }
  if (source === "naver") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#03C75A]/10">
        <span className="text-[10px] font-extrabold text-[#03C75A]">B</span>
      </span>
    );
  }
  if (source === "google") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      </span>
    );
  }
  return null;
}

const typeLabels: Record<MonitoringType, string> = {
  comment: "댓글",
  blog: "블로그",
  cafe: "카페",
  web: "웹",
  news: "뉴스",
  general: "일반",
};

function timeAgo(iso: string): string {
  if (!iso) return "날짜 미상";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "날짜 미상";

    const ms = Date.now() - date.getTime();
    if (ms < 0) return "날짜 미상"; // future date
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return "방금 전";
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    if (days < 365) return `${Math.floor(days / 30)}개월 전`;
    return `${Math.floor(days / 365)}년 전`;
  } catch {
    return "날짜 미상";
  }
}

function formatFullDate(iso: string): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Feed Item Card                                                      */
/* ------------------------------------------------------------------ */
interface FeedItemProps {
  item: MonitoringItem;
}

function FeedItemCard({ item }: FeedItemProps) {
  const sourceBadge = getSourceBadge(item.link);
  const domain = getDomain(item.link);
  const fullDate = formatFullDate(item.publishedAt);

  return (
    <div
      className="group relative flex gap-3 rounded-lg border border-border p-4 transition-all hover:border-muted-foreground/30 hover:shadow-sm"
    >
      {/* Platform icon */}
      <div className="shrink-0 pt-0.5">
        <PlatformIcon source={item.source} type={item.type} />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Top row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {typeLabels[item.type] ?? item.type}
          </span>
          <span className="text-[10px] text-muted-foreground/60">|</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60" title={fullDate}>
            <Clock className="h-2.5 w-2.5" />
            {fullDate || "날짜 미상"}
          </span>
          {/* Source domain badge */}
          {sourceBadge && (
            <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${sourceBadge.color}`}>
              {sourceBadge.label}
            </Badge>
          )}
          {!sourceBadge && domain && item.source === "google" && (
            <span className="text-[9px] text-muted-foreground/50">{domain}</span>
          )}
        </div>

        {/* Title */}
        <h4 className="text-sm font-medium text-foreground leading-snug line-clamp-1">
          {item.title}
        </h4>

        {/* Content preview */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {item.content}
        </p>

        {/* Author + link */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground/50">{item.author}</span>
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-2.5 w-2.5" />
            원본
          </a>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline Feed                                                       */
/* ------------------------------------------------------------------ */
interface TimelineFeedProps {
  items: MonitoringItem[];
  keywords: string[];
  watchedCafes?: string[];
  activeFilters?: string[];
}

const ALL_CATEGORIES = ["blog", "cafe", "google", "youtube"];

function getItemCategory(item: MonitoringItem): string {
  if (item.source === "naver" && item.type === "blog") return "blog";
  if (item.source === "naver" && item.type === "cafe") return "cafe";
  if (item.source === "google") return "google";
  if (item.source === "youtube") return "youtube";
  return "google";
}

export function TimelineFeed({ items, keywords, activeFilters }: TimelineFeedProps) {
  const filters = activeFilters ?? [...ALL_CATEGORIES];

  const dedupedItems = useMemo(() => {
    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    });

    deduped.sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    return deduped;
  }, [items, keywords]);

  const filteredItems = useMemo(() => {
    if (filters.length === 0) return [];
    return dedupedItems.filter((item) => filters.includes(getItemCategory(item)));
  }, [dedupedItems, filters]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-foreground tracking-tight">
          실시간 피드
        </h2>
        <Badge variant="secondary" className="text-[10px] font-mono bg-card text-muted-foreground">
          {filteredItems.length}/{dedupedItems.length}건
        </Badge>
      </div>

      {/* Feed */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card py-16">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Activity className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">아직 수집된 데이터가 없습니다.</p>
          <p className="text-xs text-muted-foreground/60">
            검색어를 입력하여 모니터링을 시작하세요.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredItems.map((item) => (
            <FeedItemCard
              key={`${item.source}-${item.id}`}
              item={item}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Activity(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
    </svg>
  );
}
