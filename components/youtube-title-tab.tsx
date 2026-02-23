"use client";

import React from "react";
import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Youtube, Loader2, ExternalLink, Search, RefreshCw, Clock, X, Trash2 } from "lucide-react";
import type { MonitoringItem } from "@/lib/types";
import { DEFAULT_BRAND_KEYWORDS } from "@/lib/types";

/* ------------------------------------------------------------------ */
const RECENT_KEY = "fitcnic_yt_title_recent";
const MAX_RECENT = 8;

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
}

interface YouTubeTitleTabProps {
  onItemsCollected?: (items: MonitoringItem[]) => void;
}

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

export function YouTubeTitleTab({ onItemsCollected }: YouTubeTitleTabProps) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

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

  const search = useCallback(async (input?: string) => {
    const keyword = (input ?? searchKeyword).trim();
    if (!keyword) {
      setError("검색어를 입력해주세요.");
      return;
    }

    saveRecent(keyword);
    setIsLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch(
        `/api/youtube/search?keyword=${encodeURIComponent(keyword)}&maxResults=20`
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `YouTube 검색 실패 (${res.status})`);
      }

      const data = await res.json();
      setResults(data.items || []);

      if (onItemsCollected && data.items?.length) {
        const monitoringItems: MonitoringItem[] = data.items.map(
          (item: YouTubeSearchResult) => ({
            id: `yt-search-${item.videoId}`,
            source: "youtube" as const,
            type: "general" as const,
            title: item.title,
            content: item.description,
            author: item.channelTitle,
            link: `https://www.youtube.com/watch?v=${item.videoId}`,
            publishedAt: item.publishedAt,
            matchedKeywords: [],
            isFlagged: false,
          })
        );
        onItemsCollected(monitoringItems);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [searchKeyword, saveRecent, onItemsCollected]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
    }
  };

  const handleClearResults = useCallback(() => {
    setResults([]);
    setSearched(false);
    setError(null);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-[#FF0000]" />
            <CardTitle className="text-lg text-card-foreground">유튜브 영상 검색 (제목)</CardTitle>
            {searched && results.length > 0 && <Badge variant="secondary" className="text-xs">{results.length}건</Badge>}
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
              {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" />검색 중...</>) : (<><Search className="h-4 w-4" />영상 검색</>)}
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
          <p className="text-xs text-muted-foreground">Enter 키를 누르면 YouTube에서 키워드로 최신 영상을 검색합니다.</p>

          {/* Recent searches */}
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
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      )}

      {/* Results */}
      {searched && results.length > 0 && !isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="pt-4">
            <div className="rounded-lg border border-border overflow-auto max-h-[650px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground w-[80px]">썸네일</TableHead>
                    <TableHead className="text-muted-foreground w-[300px]">제목</TableHead>
                    <TableHead className="text-muted-foreground w-[140px]">채널명</TableHead>
                    <TableHead className="text-muted-foreground w-[100px]">게시일</TableHead>
                    <TableHead className="text-muted-foreground w-[100px] text-center">링크</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((item) => (
                    <TableRow
                      key={item.videoId}
                      className="border-border hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => window.open(`https://www.youtube.com/watch?v=${item.videoId}`, "_blank", "noopener,noreferrer")}
                    >
                      <TableCell className="align-top py-2">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt="" className="w-[72px] h-[40px] object-cover rounded" />
                        ) : (
                          <div className="w-[72px] h-[40px] rounded bg-muted flex items-center justify-center">
                            <Youtube className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground align-top">
                        <span className="line-clamp-2">{item.title}</span>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground align-top">
                        <span className="truncate block max-w-[130px]">{item.channelTitle}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground align-top">{formatDate(item.publishedAt)}</TableCell>
                      <TableCell className="text-center align-top">
                        <a
                          href={`https://www.youtube.com/watch?v=${item.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          title="영상 보기"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !searched && (
        <Card className="border-border bg-card">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <Youtube className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">검색어를 입력하여 YouTube 영상을 검색하세요.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {searched && results.length === 0 && !isLoading && !error && (
        <Card className="border-border bg-card">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <Youtube className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
