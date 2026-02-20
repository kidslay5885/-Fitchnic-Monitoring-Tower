"use client";

import React from "react";
import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Radar,
  Search,
  Clock,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Globe,
  Youtube,
  Coffee,
} from "lucide-react";
import type { MonitoringItem, PlatformSource } from "@/lib/types";
import { DEFAULT_BRAND_KEYWORDS } from "@/lib/types";
import { TimelineFeed } from "@/components/timeline-feed";
import {
  buildGoogleRiskQuery,
  buildSocialQueries,
  buildNaverQueries,
} from "@/lib/query-packs";

/* ------------------------------------------------------------------ */
const RECENT_SEARCHES_KEY = "fitcnic_recent_searches";
const MAX_RECENT = 8;

const ALL_CATEGORIES = ["blog", "cafe", "google", "youtube"];

interface PlatformScanState {
  status: "idle" | "scanning" | "filtering" | "done" | "error";
  collected: number;
  filtered: number;
  message: string;
}

interface UnifiedScanProps {
  onItemsCollected?: (items: MonitoringItem[]) => void;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

function flexibleIncludes(text: string, keyword: string): boolean {
  return normalise(text).includes(normalise(keyword));
}

function matchesAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => flexibleIncludes(text, kw));
}

/* ------------------------------------------------------------------ */
export function UnifiedScan({ onItemsCollected }: UnifiedScanProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);

  // Per-keyword results
  const [searchedKeywords, setSearchedKeywords] = useState<string[]>([]);
  const [itemsByKeyword, setItemsByKeyword] = useState<Record<string, MonitoringItem[]>>({});
  const [activeKeyword, setActiveKeyword] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([...ALL_CATEGORIES]);

  const [platformStates, setPlatformStates] = useState<Record<string, PlatformScanState>>({
    naver: { status: "idle", collected: 0, filtered: 0, message: "대기 중" },
    cafe: { status: "idle", collected: 0, filtered: 0, message: "대기 중" },
    google: { status: "idle", collected: 0, filtered: 0, message: "대기 중" },
    youtube: { status: "idle", collected: 0, filtered: 0, message: "대기 중" },
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecentSearches(parsed);
      }
    } catch {}
  }, []);

  const saveRecentSearch = useCallback((queries: string | string[]) => {
    const list = Array.isArray(queries) ? queries : [queries];
    setRecentSearches((prev) => {
      let updated = [...prev];
      for (const q of list) {
        updated = [q, ...updated.filter((s) => s !== q)];
      }
      updated = updated.slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== query);
      try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const updatePlatform = useCallback(
    (platform: string, patch: Partial<PlatformScanState>) => {
      setPlatformStates((prev) => ({
        ...prev,
        [platform]: { ...prev[platform], ...patch },
      }));
    },
    []
  );

  /* ---------------------------------------------------------------- */
  /*  Google scan                                                      */
  /* ---------------------------------------------------------------- */
  const scanGoogle = useCallback(
    async (keywords: string[]): Promise<MonitoringItem[]> => {
      updatePlatform("google", { status: "scanning", collected: 0, filtered: 0, message: "Google 검색 시작..." });

      const allResults: MonitoringItem[] = [];
      let totalCollected = 0;

      const allQueries: { query: string; baseKeyword: string }[] = [];
      for (const kw of keywords) {
        allQueries.push({ query: kw, baseKeyword: kw });
        allQueries.push({ query: buildGoogleRiskQuery(kw), baseKeyword: kw });
        for (const sq of buildSocialQueries(kw)) {
          allQueries.push({ query: sq, baseKeyword: kw });
        }
      }

      const tasks = allQueries.map(async ({ query, baseKeyword }) => {
        try {
          const res = await fetch(`/api/google/search?keyword=${encodeURIComponent(query)}&num=50`);
          if (!res.ok) return [];
          const data = await res.json();
          totalCollected += data.items.length;
          updatePlatform("google", { collected: totalCollected, message: `"${baseKeyword}": ${totalCollected}건 수집...` });
          return data.items.map((item: any) => ({
            id: item.id,
            source: "google" as const,
            type: "web" as const,
            title: item.title,
            content: item.content,
            author: item.author,
            link: item.link,
            publishedAt: item.publishedAt || "",
            matchedKeywords: [] as string[],
            isFlagged: false,
            searchKeyword: baseKeyword,
          }));
        } catch { return []; }
      });

      const results = await Promise.all(tasks);
      for (const batch of results) allResults.push(...batch);

      const seen = new Set<string>();
      const deduped = allResults.filter((item) => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
      });

      updatePlatform("google", { status: "done", collected: allResults.length, filtered: deduped.length, message: `완료 - ${deduped.length}건` });
      return deduped;
    },
    [updatePlatform]
  );

  /* ---------------------------------------------------------------- */
  /*  YouTube scan                                                     */
  /* ---------------------------------------------------------------- */
  const scanYouTube = useCallback(
    async (keywords: string[]): Promise<MonitoringItem[]> => {
      updatePlatform("youtube", { status: "scanning", collected: 0, filtered: 0, message: "YouTube 검색 시작..." });

      const allResults: MonitoringItem[] = [];
      let totalCollected = 0;

      const tasks = keywords.map(async (keyword) => {
        try {
          const res = await fetch(`/api/youtube/search?keyword=${encodeURIComponent(keyword)}&maxResults=20`);
          if (!res.ok) return [];
          const data = await res.json();
          const items = data.items || [];
          totalCollected += items.length;
          updatePlatform("youtube", { collected: totalCollected, message: `"${keyword}": ${items.length}건 수집...` });
          return items.map((item: any) => ({
            id: `yt-search-${item.videoId}`,
            source: "youtube" as const,
            type: "general" as const,
            title: item.title,
            content: item.description,
            author: item.channelTitle,
            link: `https://www.youtube.com/watch?v=${item.videoId}`,
            publishedAt: item.publishedAt || "",
            matchedKeywords: [] as string[],
            isFlagged: false,
            searchKeyword: keyword,
          }));
        } catch { return []; }
      });

      const results = await Promise.all(tasks);
      for (const batch of results) allResults.push(...batch);

      const seen = new Set<string>();
      const deduped = allResults.filter((item) => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
      });

      updatePlatform("youtube", { status: "done", collected: allResults.length, filtered: deduped.length, message: `완료 - ${deduped.length}건` });
      return deduped;
    },
    [updatePlatform]
  );

  /* ---------------------------------------------------------------- */
  /*  Naver blog scan                                                  */
  /* ---------------------------------------------------------------- */
  const scanNaver = useCallback(
    async (keywords: string[]): Promise<MonitoringItem[]> => {
      updatePlatform("naver", { status: "scanning", collected: 0, filtered: 0, message: "블로그 검색 시작..." });

      const allResults: MonitoringItem[] = [];
      let totalCollected = 0;

      const tasks = keywords.flatMap((baseKw) => {
        const expanded = buildNaverQueries(baseKw);
        return expanded.map(async (query) => {
          try {
            const res = await fetch(`/api/naver/search?keyword=${encodeURIComponent(query)}&type=blog&start=1`);
            if (!res.ok) return [];
            const data = await res.json();
            totalCollected += data.items.length;
            updatePlatform("naver", { collected: totalCollected, message: `블로그 "${baseKw}" ${totalCollected}건...` });
            return data.items.map((item: any) => ({
              id: item.id,
              source: "naver" as const,
              type: item.type as MonitoringItem["type"],
              title: item.title,
              content: item.content,
              author: item.author,
              authorUrl: item.authorUrl,
              link: item.link,
              publishedAt: item.publishedAt,
              matchedKeywords: [] as string[],
              isFlagged: false,
              searchKeyword: baseKw,
            }));
          } catch { return []; }
        });
      });

      const results = await Promise.all(tasks);
      for (const batch of results) allResults.push(...batch);

      const filtered = allResults.filter(
        (r) => matchesAnyKeyword(r.title, keywords) || matchesAnyKeyword(r.content, keywords)
      );

      const seen = new Set<string>();
      const deduped = filtered.filter((item) => {
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
      });

      updatePlatform("naver", { status: "done", collected: allResults.length, filtered: deduped.length, message: `완료 - ${deduped.length}건` });
      return deduped;
    },
    [updatePlatform]
  );

  /* ---------------------------------------------------------------- */
  /*  Naver cafe scan (dedicated endpoint)                             */
  /* ---------------------------------------------------------------- */
  const scanCafe = useCallback(
    async (keywords: string[]): Promise<MonitoringItem[]> => {
      updatePlatform("cafe", { status: "scanning", collected: 0, filtered: 0, message: "카페 검색 시작..." });

      const allResults: MonitoringItem[] = [];
      let totalCollected = 0;

      const tasks = keywords.map(async (keyword) => {
        try {
          const res = await fetch(
            `/api/naver/cafe?keyword=${encodeURIComponent(keyword)}&display=30&sort=date`,
            { cache: "no-store" }
          );
          if (!res.ok) return [];
          const data = await res.json();
          totalCollected += (data.items || []).length;
          updatePlatform("cafe", { collected: totalCollected, message: `카페 "${keyword}" ${totalCollected}건...` });
          return (data.items || []).map((item: any) => ({
            id: item.id,
            source: "naver" as const,
            type: "cafe" as const,
            title: item.title,
            content: item.content,
            author: item.cafeName || item.author,
            link: item.link,
            publishedAt: item.publishedAt,
            matchedKeywords: [] as string[],
            isFlagged: false,
            searchKeyword: keyword,
          }));
        } catch { return []; }
      });

      const results = await Promise.all(tasks);
      for (const batch of results) allResults.push(...batch);

      const seen = new Set<string>();
      const deduped = allResults.filter((item) => {
        if (!item.link) return false;
        if (seen.has(item.link)) return false;
        seen.add(item.link);
        return true;
      });

      updatePlatform("cafe", { status: "done", collected: allResults.length, filtered: deduped.length, message: `완료 - ${deduped.length}건` });
      return deduped;
    },
    [updatePlatform]
  );

  /* ---------------------------------------------------------------- */
  /*  Main scan                                                        */
  /* ---------------------------------------------------------------- */
  const handleScan = useCallback(async (query?: string) => {
    const searchTerms = query || searchQuery;
    if (!searchTerms.trim()) return;

    const keywords = searchTerms.split(",").map((s) => s.trim()).filter(Boolean);
    if (keywords.length === 0) return;

    saveRecentSearch(keywords);
    setIsScanning(true);
    setScanComplete(false);
    setItemsByKeyword({});
    setSearchedKeywords(keywords);
    setActiveKeyword(keywords[0]);
    setActiveFilters([...ALL_CATEGORIES]);

    setPlatformStates({
      naver: { status: "idle", collected: 0, filtered: 0, message: "준비 중..." },
      cafe: { status: "idle", collected: 0, filtered: 0, message: "준비 중..." },
      google: { status: "idle", collected: 0, filtered: 0, message: "준비 중..." },
      youtube: { status: "idle", collected: 0, filtered: 0, message: "준비 중..." },
    });

    const [naverResults, cafeResults, googleResults, youtubeResults] = await Promise.all([
      scanNaver(keywords).catch((err) => {
        updatePlatform("naver", { status: "error", message: err instanceof Error ? err.message : "블로그 스캔 실패" });
        return [] as MonitoringItem[];
      }),
      scanCafe(keywords).catch((err) => {
        updatePlatform("cafe", { status: "error", message: err instanceof Error ? err.message : "카페 스캔 실패" });
        return [] as MonitoringItem[];
      }),
      scanGoogle(keywords).catch((err) => {
        updatePlatform("google", { status: "error", message: err instanceof Error ? err.message : "Google 스캔 실패" });
        return [] as MonitoringItem[];
      }),
      scanYouTube(keywords).catch((err) => {
        updatePlatform("youtube", { status: "error", message: err instanceof Error ? err.message : "YouTube 스캔 실패" });
        return [] as MonitoringItem[];
      }),
    ]);

    const allItems = [...naverResults, ...cafeResults, ...googleResults, ...youtubeResults];

    const seen = new Set<string>();
    const deduped = allItems.filter((item) => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    });

    // Group by keyword
    const grouped: Record<string, MonitoringItem[]> = {};
    for (const kw of keywords) {
      grouped[kw] = deduped
        .filter((item) => item.searchKeyword === kw)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    }

    setItemsByKeyword(grouped);
    onItemsCollected?.(deduped);
    setIsScanning(false);
    setScanComplete(true);
  }, [searchQuery, saveRecentSearch, scanNaver, scanCafe, scanGoogle, scanYouTube, onItemsCollected, updatePlatform]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  // Current keyword's data
  const currentItems = itemsByKeyword[activeKeyword] || [];
  const blogCount = currentItems.filter((i) => i.source === "naver" && i.type === "blog").length;
  const cafeCount = currentItems.filter((i) => i.source === "naver" && i.type === "cafe").length;
  const googleCount = currentItems.filter((i) => i.source === "google").length;
  const youtubeCount = currentItems.filter((i) => i.source === "youtube").length;
  const totalAll = Object.values(itemsByKeyword).reduce((sum, arr) => sum + arr.length, 0);

  const showLanding = !isScanning && !scanComplete;

  return (
    <div className="flex flex-col gap-6">
      {showLanding ? (
        <div className="flex flex-col items-center gap-8 py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Radar className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">통합 모니터링 검색</h2>
            <p className="text-sm text-muted-foreground">
              검색어를 입력하면 네이버 블로그, 카페, 구글, 유튜브를 동시에 검색합니다
            </p>
          </div>

          <div className="flex w-full max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={DEFAULT_BRAND_KEYWORDS.join(", ")}
                className="h-12 pl-10 pr-4 text-base bg-card border-border shadow-sm"
              />
            </div>
            <Button
              size="lg"
              onClick={() => handleScan()}
              disabled={!searchQuery.trim()}
              className="h-12 gap-2 px-6 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              <Radar className="h-4 w-4" />
              스캔 시작
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            여러 키워드를 쉼표(,)로 구분하면 각각 독립적으로 검색됩니다
          </p>

          {recentSearches.length > 0 && (
            <div className="flex flex-col items-center gap-3 w-full max-w-xl">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                최근 검색
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {recentSearches.map((q) => (
                  <Badge
                    key={q}
                    variant="secondary"
                    className="cursor-pointer gap-1.5 px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                    onClick={() => { setSearchQuery(q); handleScan(q); }}
                  >
                    {q}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeRecentSearch(q); }}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="min-h-[calc(100vh-180px)] flex flex-col gap-6">
          {/* Compact search bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={DEFAULT_BRAND_KEYWORDS.join(", ")}
                className="h-10 pl-10 pr-4 text-sm bg-card border-border"
              />
            </div>
            <Button
              onClick={() => handleScan()}
              disabled={isScanning || !searchQuery.trim()}
              className="h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isScanning ? (
                <><Loader2 className="h-4 w-4 animate-spin" />스캔 중...</>
              ) : (
                <><Radar className="h-4 w-4" />재검색</>
              )}
            </Button>
          </div>

          {/* Loading */}
          {isScanning && (
            <div className="flex flex-col gap-4">
              <Card className="border-border bg-card">
                <CardContent className="py-4">
                  <div className="flex flex-col gap-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      스캔 진행 상황
                    </span>
                    <PlatformProgress label="블로그" icon={<span className="flex h-5 w-5 items-center justify-center rounded bg-[#03C75A] text-[8px] font-bold text-white">B</span>} state={platformStates.naver} />
                    <PlatformProgress label="카페" icon={<span className="flex h-5 w-5 items-center justify-center rounded bg-[#795C34] text-white"><Coffee className="h-3 w-3" /></span>} state={platformStates.cafe} />
                    <PlatformProgress label="구글" icon={<Globe className="h-5 w-5 text-primary" />} state={platformStates.google} />
                    <PlatformProgress label="유튜브" icon={<Youtube className="h-5 w-5 text-[#FF0000]" />} state={platformStates.youtube} />
                  </div>
                </CardContent>
              </Card>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
              </div>
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
              </div>
            </div>
          )}

          {/* Results */}
          {scanComplete && (
            <div className="flex flex-col gap-4">
              {/* Platform progress summary */}
              <Card className="border-border bg-card">
                <CardContent className="py-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">스캔 완료</span>
                      <span className="text-xs text-muted-foreground">총 {totalAll}건 수집</span>
                    </div>
                    <PlatformProgress label="블로그" icon={<span className="flex h-5 w-5 items-center justify-center rounded bg-[#03C75A] text-[8px] font-bold text-white">B</span>} state={platformStates.naver} />
                    <PlatformProgress label="카페" icon={<span className="flex h-5 w-5 items-center justify-center rounded bg-[#795C34] text-white"><Coffee className="h-3 w-3" /></span>} state={platformStates.cafe} />
                    <PlatformProgress label="구글" icon={<Globe className="h-5 w-5 text-primary" />} state={platformStates.google} />
                    <PlatformProgress label="유튜브" icon={<Youtube className="h-5 w-5 text-[#FF0000]" />} state={platformStates.youtube} />
                  </div>
                </CardContent>
              </Card>

              {/* Keyword tabs */}
              {searchedKeywords.length > 1 ? (
                <Tabs value={activeKeyword} onValueChange={(v) => { setActiveKeyword(v); setActiveFilters([...ALL_CATEGORIES]); }}>
                  <TabsList className="bg-card border border-border overflow-x-auto">
                    {searchedKeywords.map((kw) => (
                      <TabsTrigger key={kw} value={kw} className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                        {kw}
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">{itemsByKeyword[kw]?.length || 0}</Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {searchedKeywords.map((kw) => (
                    <TabsContent key={kw} value={kw} className="mt-4">
                      <KeywordResults
                        items={itemsByKeyword[kw] || []}
                        keyword={kw}
                        activeFilters={activeKeyword === kw ? activeFilters : ALL_CATEGORIES}
                        onFiltersChange={setActiveFilters}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <KeywordResults
                  items={currentItems}
                  keyword={searchedKeywords[0] || ""}
                  activeFilters={activeFilters}
                  onFiltersChange={setActiveFilters}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Per-keyword results section                                        */
/* ------------------------------------------------------------------ */
function KeywordResults({
  items,
  keyword,
  activeFilters,
  onFiltersChange,
}: {
  items: MonitoringItem[];
  keyword: string;
  activeFilters: string[];
  onFiltersChange: (f: string[]) => void;
}) {
  const blogCount = items.filter((i) => i.source === "naver" && i.type === "blog").length;
  const cafeCount = items.filter((i) => i.source === "naver" && i.type === "cafe").length;
  const googleCount = items.filter((i) => i.source === "google").length;
  const youtubeCount = items.filter((i) => i.source === "youtube").length;

  const allSelected = ALL_CATEGORIES.every((c) => activeFilters.includes(c));

  const toggleFilter = (cat: string) => {
    onFiltersChange(
      activeFilters.includes(cat)
        ? activeFilters.filter((c) => c !== cat)
        : [...activeFilters, cat]
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      onFiltersChange([]);
    } else {
      onFiltersChange([...ALL_CATEGORIES]);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Summary cards — clickable to toggle filter (multi-select) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard
          label="전체"
          count={blogCount + cafeCount + googleCount + youtubeCount}
          icon={
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/15 text-[9px] font-bold text-primary">All</span>
          }
          accentColor="border-primary"
          active={allSelected}
          onClick={toggleAll}
        />
        <SummaryCard
          label="블로그"
          count={blogCount}
          icon={
            <span className="flex h-6 w-6 items-center justify-center rounded bg-[#03C75A]/15 text-[9px] font-bold text-[#03C75A]">B</span>
          }
          accentColor="border-[#03C75A]"
          active={activeFilters.includes("blog")}
          onClick={() => toggleFilter("blog")}
        />
        <SummaryCard
          label="카페"
          count={cafeCount}
          icon={
            <span className="flex h-6 w-6 items-center justify-center rounded bg-[#795C34]/10">
              <Coffee className="h-3.5 w-3.5 text-[#795C34]" />
            </span>
          }
          accentColor="border-[#795C34]"
          active={activeFilters.includes("cafe")}
          onClick={() => toggleFilter("cafe")}
        />
        <SummaryCard
          label="구글"
          count={googleCount}
          icon={<Globe className="h-5 w-5 text-blue-500" />}
          accentColor="border-blue-500"
          active={activeFilters.includes("google")}
          onClick={() => toggleFilter("google")}
        />
        <SummaryCard
          label="유튜브"
          count={youtubeCount}
          icon={<Youtube className="h-5 w-5 text-[#FF0000]" />}
          accentColor="border-[#FF0000]"
          active={activeFilters.includes("youtube")}
          onClick={() => toggleFilter("youtube")}
        />
      </div>

      {/* Timeline feed */}
      <TimelineFeed
        items={items}
        keywords={[keyword]}
        activeFilters={activeFilters}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Card                                                       */
/* ------------------------------------------------------------------ */
function SummaryCard({
  label,
  count,
  icon,
  active,
  accentColor,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  active?: boolean;
  accentColor?: string;
  onClick?: () => void;
}) {
  const activeRing = accentColor
    ? `ring-2 ring-offset-1 ${accentColor} border-transparent`
    : "ring-2 ring-primary border-primary";

  return (
    <Card
      className={`border-border bg-card cursor-pointer transition-all hover:shadow-sm ${active ? activeRing : ""}`}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 py-4">
        {icon}
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-xl font-bold text-foreground">{count}건</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress row                                                       */
/* ------------------------------------------------------------------ */
function PlatformProgress({
  label,
  icon,
  state,
}: {
  label: string;
  icon: React.ReactNode;
  state: PlatformScanState;
}) {
  const progressValue =
    state.status === "done" ? 100
      : state.status === "filtering" ? 80
        : state.status === "scanning" ? Math.min(60, state.collected)
          : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-foreground">{label}</span>
          {state.status === "scanning" && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          {state.status === "filtering" && <Loader2 className="h-3 w-3 animate-spin text-amber-500" />}
          {state.status === "done" && <CheckCircle2 className="h-3 w-3 text-primary" />}
          {state.status === "error" && <XCircle className="h-3 w-3 text-destructive" />}
        </div>
        <div className="flex items-center gap-2">
          {state.collected > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">{state.collected}건 수집</Badge>
          )}
          {state.filtered > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary">{state.filtered}건 유효</Badge>
          )}
        </div>
      </div>
      <Progress value={progressValue} className="h-1.5" />
      <p className="text-[11px] text-muted-foreground">{state.message}</p>
    </div>
  );
}
