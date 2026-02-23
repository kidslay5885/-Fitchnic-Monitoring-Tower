"use client";

import React from "react";
import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Globe, Loader2, ExternalLink, RefreshCw, Search, Clock, X, ChevronDown, Trash2 } from "lucide-react";
import type { MonitoringItem } from "@/lib/types";
import { DEFAULT_BRAND_KEYWORDS } from "@/lib/types";
import {
  buildGoogleRiskQuery,
  buildSocialQueries,
} from "@/lib/query-packs";

/* ------------------------------------------------------------------ */
const RECENT_KEY = "fitcnic_google_recent";
const MAX_RECENT = 8;
const PAGE_SIZE = 50;

interface GoogleResult {
  id: string;
  source: "google";
  type: "web";
  title: string;
  content: string;
  author: string;
  link: string;
  publishedAt: string;
  searchKeyword?: string;
  kind?: string;
}

interface GoogleTabProps {
  onItemsCollected?: (items: MonitoringItem[]) => void;
}

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
  "naver.com": { label: "Naver", color: "bg-green-50 text-green-700 border-green-200" },
  "blog.naver.com": { label: "Naver Blog", color: "bg-green-50 text-green-700 border-green-200" },
  "cafe.naver.com": { label: "Naver Cafe", color: "bg-green-50 text-green-700 border-green-200" },
  "brunch.co.kr": { label: "Brunch", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "tistory.com": { label: "Tistory", color: "bg-orange-50 text-orange-700 border-orange-200" },
  "daum.net": { label: "Daum", color: "bg-blue-50 text-blue-700 border-blue-200" },
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
/*  Platform Icons for table rows                                       */
/* ------------------------------------------------------------------ */
function PlatformIconForDomain({ link }: { link: string }) {
  const domain = getDomain(link);
  const hostname = domain.toLowerCase();

  // Instagram
  if (hostname.includes("instagram.com")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
        <defs>
          <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FD5" />
            <stop offset="50%" stopColor="#FF543E" />
            <stop offset="100%" stopColor="#C837AB" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)" strokeWidth="2" />
        <circle cx="12" cy="12" r="5" stroke="url(#ig-grad)" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-grad)" />
      </svg>
    );
  }

  // Threads
  if (hostname.includes("threads.net") || hostname.includes("threads.com")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.762 2.083-1.196 3.584-1.291a15.46 15.46 0 0 1 2.89.118c-.12-.602-.35-1.1-.692-1.483-.468-.524-1.15-.79-2.03-.79h-.06c-.964.013-1.783.396-2.175.96l-1.616-1.147c.753-1.084 1.99-1.68 3.482-1.68h.094c3.322.044 4.386 2.586 4.56 4.122.56.16 1.073.37 1.532.632 1.594.91 2.59 2.18 2.877 3.677.34 1.766-.03 3.652-1.07 5.46C19.865 22.252 16.983 23.978 12.186 24Zm-1.638-8.544c-.015.272.092.51.32.707.297.256.702.393 1.204.407 1.01-.055 1.76-.402 2.232-1.034.37-.496.617-1.135.74-1.905a10.24 10.24 0 0 0-2.416-.253c-1.56.086-2.14.732-2.08 2.078Z" />
      </svg>
    );
  }

  // X/Twitter
  if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  // Facebook
  if (hostname.includes("facebook.com")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    );
  }

  // Reddit
  if (hostname.includes("reddit.com")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#FF4500">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
      </svg>
    );
  }

  // TikTok
  if (hostname.includes("tiktok.com")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.54a8.27 8.27 0 0 0 4.86 1.57V6.69h-1.1z" />
      </svg>
    );
  }

  // YouTube
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#FF0000">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.9 31.9 0 0 0 0 12a31.9 31.9 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-5.8.5-5.8s0-3.9-.5-5.8ZM9.8 15.5V8.5l6.2 3.5-6.2 3.5Z" />
      </svg>
    );
  }

  // Naver Blog
  if (hostname.includes("blog.naver.com")) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#03C75A] text-[7px] font-bold text-white">B</span>
    );
  }

  // Naver Cafe
  if (hostname.includes("cafe.naver.com")) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#03C75A] text-[7px] font-bold text-white">C</span>
    );
  }

  // Naver (general)
  if (hostname.includes("naver.com")) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#03C75A] text-[7px] font-bold text-white">N</span>
    );
  }

  // Brunch
  if (hostname.includes("brunch.co.kr")) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#333] text-[7px] font-bold text-white">B</span>
    );
  }

  // Tistory
  if (hostname.includes("tistory.com")) {
    return (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#EB5600">
        <circle cx="12" cy="6" r="3" />
        <circle cx="5" cy="18" r="3" />
        <circle cx="19" cy="18" r="3" />
      </svg>
    );
  }

  // Daum
  if (hostname.includes("daum.net")) {
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#0068B7] text-[7px] font-bold text-white">D</span>
    );
  }

  // Default: Google
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// Extended social site queries for Google tab
function buildExtendedSocialQueries(brand: string): string[] {
  return [
    ...buildSocialQueries(brand),
    `site:brunch.co.kr "${brand}"`,
    `site:tistory.com "${brand}"`,
    `site:daum.net "${brand}"`,
  ];
}

/* ------------------------------------------------------------------ */
export function GoogleTab({ onItemsCollected }: GoogleTabProps) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [resultsByKeyword, setResultsByKeyword] = useState<Record<string, GoogleResult[]>>({});
  const [searchedKeywords, setSearchedKeywords] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  // Track API pagination offset per keyword
  const [apiOffsets, setApiOffsets] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecentSearches(parsed);
      }
    } catch {}
  }, []);

  const saveRecent = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const updated = [query, ...prev.filter((s) => s !== query)].slice(0, MAX_RECENT);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  const removeRecent = useCallback((query: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== query);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  // Fetch all expanded queries for a keyword
  const fetchExpandedResults = useCallback(async (keyword: string, startOffset = 0): Promise<GoogleResult[]> => {
    const allQueries: string[] = [keyword];
    allQueries.push(buildGoogleRiskQuery(keyword));
    for (const sq of buildExtendedSocialQueries(keyword)) {
      allQueries.push(sq);
    }

    const tasks = allQueries.map(async (query) => {
      try {
        const res = await fetch(
          `/api/google/search?keyword=${encodeURIComponent(query)}&num=50&start=${startOffset}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.items || []).map((item: GoogleResult) => ({
          ...item,
          searchKeyword: keyword,
        }));
      } catch { return []; }
    });

    const results = await Promise.all(tasks);
    const allResults = results.flat();

    // Dedup by link
    const seen = new Set<string>();
    return allResults.filter((item) => {
      if (seen.has(item.link)) return false;
      seen.add(item.link);
      return true;
    });
  }, []);

  const search = useCallback(async (input?: string) => {
    const raw = input ?? searchKeyword;
    const keywords = raw.split(",").map((s) => s.trim()).filter(Boolean);

    if (keywords.length === 0) {
      setError("검색어를 입력해주세요.");
      return;
    }

    saveRecent(raw.trim());
    setIsLoading(true);
    setError(null);
    setSearched(true);
    setSearchedKeywords(keywords);

    const newResults: Record<string, GoogleResult[]> = {};
    const newVisibleCounts: Record<string, number> = {};
    const newApiOffsets: Record<string, number> = {};

    try {
      for (const keyword of keywords) {
        const items = await fetchExpandedResults(keyword, 0);
        newResults[keyword] = items;
        newVisibleCounts[keyword] = PAGE_SIZE;
        newApiOffsets[keyword] = 50; // Next fetch starts at 50
      }

      setResultsByKeyword(newResults);
      setVisibleCounts(newVisibleCounts);
      setApiOffsets(newApiOffsets);
      setActiveTab(keywords[0]);

      if (onItemsCollected) {
        const allItems: MonitoringItem[] = Object.values(newResults)
          .flat()
          .map((r) => ({
            id: r.id,
            source: "google" as const,
            type: "web" as const,
            title: r.title,
            content: r.content,
            author: r.author,
            link: r.link,
            publishedAt: r.publishedAt,
            matchedKeywords: [],
            isFlagged: false,
          }));
        onItemsCollected(allItems);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [searchKeyword, saveRecent, onItemsCollected, fetchExpandedResults]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
    }
  };

  const handleShowMore = (keyword: string) => {
    setVisibleCounts((prev) => ({
      ...prev,
      [keyword]: (prev[keyword] || PAGE_SIZE) + PAGE_SIZE,
    }));
  };

  // Load more from API
  const handleLoadMoreFromApi = useCallback(async (keyword: string) => {
    setIsLoadingMore(true);
    try {
      const offset = apiOffsets[keyword] || 50;
      const newItems = await fetchExpandedResults(keyword, offset);

      if (newItems.length > 0) {
        setResultsByKeyword((prev) => {
          const existing = prev[keyword] || [];
          const existingLinks = new Set(existing.map((r) => r.link));
          const unique = newItems.filter((item) => !existingLinks.has(item.link));
          return { ...prev, [keyword]: [...existing, ...unique] };
        });
        setApiOffsets((prev) => ({ ...prev, [keyword]: offset + 50 }));
      }
    } catch {
      // silently fail
    } finally {
      setIsLoadingMore(false);
    }
  }, [apiOffsets, fetchExpandedResults]);

  const handleClearResults = useCallback(() => {
    setResultsByKeyword({});
    setSearchedKeywords([]);
    setVisibleCounts({});
    setApiOffsets({});
    setActiveTab("");
    setSearched(false);
    setError(null);
  }, []);

  const totalCount = Object.values(resultsByKeyword).reduce((sum, items) => sum + items.length, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-card-foreground">구글 웹 검색</CardTitle>
            {searched && totalCount > 0 && <Badge variant="secondary" className="text-xs">총 {totalCount}건</Badge>}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="검색어를 입력하세요."
                className="h-10 pl-10 text-sm bg-background border-input"
              />
            </div>
            <Button onClick={() => search()} disabled={isLoading || !searchKeyword.trim()} className="h-10 gap-2">
              {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" />검색 중...</>) : (<><Search className="h-4 w-4" />구글 검색</>)}
            </Button>
            {searched && (
              <>
                <Button variant="outline" size="sm" onClick={() => search()} disabled={isLoading} className="h-10 gap-1.5 bg-transparent">
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />새로고침
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearResults} className="h-10 gap-1.5 bg-transparent text-muted-foreground hover:text-destructive hover:border-destructive/30">
                  <Trash2 className="h-3.5 w-3.5" />결과 지우기
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Enter로 검색. 여러 키워드는 쉼표(,)로 구분. Threads, Instagram, 브런치, 티스토리, 다음 등 소셜/웹 결과를 자동으로 포함합니다.
          </p>

          {recentSearches.length > 0 && !searched && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> 최근 검색</div>
              {recentSearches.map((q) => (
                <Badge key={q} variant="secondary" className="cursor-pointer gap-1 px-2 py-1 text-xs hover:bg-accent transition-colors" onClick={() => { setSearchKeyword(q); search(q); }}>
                  {q}
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeRecent(q); }} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-2 w-2" /></button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      )}

      {/* Keyword tabs + results */}
      {searched && totalCount > 0 && !isLoading && (
        <Card className="border border-border bg-card shadow-sm">
          <CardContent className="pt-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-card border border-border mb-4 overflow-x-auto">
                {searchedKeywords.map((kw) => (
                  <TabsTrigger key={kw} value={kw} className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    {kw}
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">{resultsByKeyword[kw]?.length || 0}</Badge>
                  </TabsTrigger>
                ))}
              </TabsList>

              {searchedKeywords.map((kw) => {
                const kwResults = resultsByKeyword[kw] || [];
                const kwVisible = visibleCounts[kw] || PAGE_SIZE;
                const kwDisplay = kwResults.slice(0, kwVisible);
                const kwHasMoreLocal = kwResults.length > kwVisible;

                return (
                  <TabsContent key={kw} value={kw} className="mt-0">
                    {kwResults.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">"{kw}" 검색 결과가 없습니다.</div>
                    ) : (
                      <>
                        <div className="rounded-lg border border-border overflow-auto max-h-[650px]">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground w-[40px]"></TableHead>
                                <TableHead className="text-muted-foreground w-[220px]">제목</TableHead>
                                <TableHead className="text-muted-foreground">내용</TableHead>
                                <TableHead className="text-muted-foreground w-[180px]">출처</TableHead>
                                <TableHead className="text-muted-foreground w-[60px] text-center">링크</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {kwDisplay.map((item) => {
                                const sourceBadge = getSourceBadge(item.link);
                                const domain = getDomain(item.link);
                                return (
                                  <TableRow
                                    key={item.id}
                                    className="border-border hover:bg-accent/50 cursor-pointer transition-colors"
                                    onClick={() => window.open(item.link, "_blank", "noopener,noreferrer")}
                                  >
                                    <TableCell className="align-top">
                                      <PlatformIconForDomain link={item.link} />
                                    </TableCell>
                                    <TableCell className="text-sm font-medium text-foreground align-top">
                                      <span className="line-clamp-2">{item.title}</span>
                                    </TableCell>
                                    <TableCell className="text-sm text-secondary-foreground align-top">
                                      <span className="line-clamp-2 max-w-[350px] block">{item.content}</span>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground align-top">
                                      <div className="flex flex-col gap-1">
                                        <span className="truncate block max-w-[170px]">{domain}</span>
                                        {sourceBadge && (
                                          <Badge variant="outline" className={`text-[10px] w-fit ${sourceBadge.color}`}>
                                            {sourceBadge.label}
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center align-top">
                                      <div className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium text-muted-foreground">
                                        <ExternalLink className="h-3 w-3" />
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Load more controls */}
                        <div className="flex justify-center gap-3 mt-4">
                          {kwHasMoreLocal && (
                            <Button variant="outline" size="sm" onClick={() => handleShowMore(kw)} className="gap-1.5 bg-transparent">
                              <ChevronDown className="h-3.5 w-3.5" />
                              더 보기 ({kwResults.length - kwVisible}건 남음)
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadMoreFromApi(kw)}
                            disabled={isLoadingMore}
                            className="gap-1.5 bg-transparent"
                          >
                            {isLoadingMore ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin" />검색 결과 더 불러오는 중...</>
                            ) : (
                              <><Search className="h-3.5 w-3.5" />API에서 추가 결과 불러오기</>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </TabsContent>
                );
              })}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {!isLoading && !searched && (
        <Card className="border border-border bg-card shadow-sm">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <Globe className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">검색어를 입력하여 구글 웹 검색을 시작하세요.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
