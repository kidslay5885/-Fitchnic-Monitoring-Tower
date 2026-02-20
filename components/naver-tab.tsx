"use client";

import React from "react";
import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import {
  Search,
  ExternalLink,
  AlertTriangle,
  Flag,
  Loader2,
  RefreshCw,
  BookOpen,
  CheckCircle2,
  Clock,
  X,
  ChevronDown,
  Trash2,
} from "lucide-react";
import type { MonitoringItem } from "@/lib/types";
import { DEFAULT_BRAND_KEYWORDS, DEFAULT_NEGATIVE_KEYWORDS } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Constants & Types                                                  */
/* ------------------------------------------------------------------ */
const RECENT_KEY = "fitcnic_naver_recent";
const MAX_RECENT = 8;
const PAGE_SIZE = 50;

interface NaverResult {
  id: string;
  source: "naver";
  type: "blog" | "cafe";
  title: string;
  content: string;
  author: string;
  authorUrl?: string;
  link: string;
  publishedAt: string;
  searchKeyword?: string;
}

interface NaverTabProps {
  onItemsCollected?: (items: MonitoringItem[]) => void;
}

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

function matchNegativeKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase()));
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

function highlightKeywords(text: string, keywords: string[]): React.ReactNode[] {
  if (!keywords.length || !text) return [text];
  const patterns = keywords
    .filter(Boolean)
    .map((kw) => {
      const chars = kw.replace(/\s+/g, "").split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
      return chars.join("\\s*");
    })
    .filter(Boolean);
  if (!patterns.length) return [text];
  const regex = new RegExp(`(${patterns.join("|")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) => {
    regex.lastIndex = 0;
    if (regex.test(part)) {
      regex.lastIndex = 0;
      return <mark key={i} className="bg-primary/20 text-primary font-semibold rounded-sm px-0.5">{part}</mark>;
    }
    regex.lastIndex = 0;
    return part;
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function NaverTab({ onItemsCollected }: NaverTabProps) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  // Results keyed by keyword
  const [resultsByKeyword, setResultsByKeyword] = useState<Record<string, NaverResult[]>>({});
  const [activeTab, setActiveTab] = useState("");
  const [searchedKeywords, setSearchedKeywords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDangerOnly, setShowDangerOnly] = useState(false);
  const [negativeKeywords] = useState<string[]>(() => [...DEFAULT_NEGATIVE_KEYWORDS]);
  // Pagination: how many items to show per keyword
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  // Load recent searches
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

  const searchBlogs = useCallback(
    async (input?: string) => {
      const raw = input ?? searchKeyword;
      const keywords = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (keywords.length === 0) {
        setError("검색어를 입력해주세요.");
        return;
      }

      saveRecent(raw.trim());
      setIsLoading(true);
      setError(null);
      setSearchedKeywords(keywords);

      const newResults: Record<string, NaverResult[]> = {};
      const newVisibleCounts: Record<string, number> = {};

      try {
        for (const keyword of keywords) {
          // Blog only (type=blog)
          const res = await fetch(`/api/naver/search?keyword=${encodeURIComponent(keyword)}&type=blog&start=1`);
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || "블로그 검색 실패");
          }
          const data = await res.json();
          const items: NaverResult[] = data.items
            .filter((item: NaverResult) => item.type === "blog")
            .map((item: NaverResult) => ({ ...item, searchKeyword: keyword }));

          // Sort by date, dedup
          items.sort((a: NaverResult, b: NaverResult) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
          const seen = new Set<string>();
          newResults[keyword] = items.filter((item: NaverResult) => {
            if (seen.has(item.link)) return false;
            seen.add(item.link);
            return true;
          });
          newVisibleCounts[keyword] = PAGE_SIZE;
        }

        setResultsByKeyword(newResults);
        setVisibleCounts(newVisibleCounts);
        setActiveTab(keywords[0]);

        if (onItemsCollected) {
          const all = Object.values(newResults).flat();
          const monitoringItems: MonitoringItem[] = all.map((r) => ({
            id: r.id,
            source: "naver" as const,
            type: r.type as MonitoringItem["type"],
            title: r.title,
            content: r.content,
            author: r.author,
            authorUrl: r.authorUrl || undefined,
            link: r.link,
            publishedAt: r.publishedAt,
            matchedKeywords: [],
            isFlagged: false,
          }));
          onItemsCollected(monitoringItems);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [searchKeyword, saveRecent, onItemsCollected]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchBlogs();
    }
  };

  const handleLoadMore = (keyword: string) => {
    setVisibleCounts((prev) => ({
      ...prev,
      [keyword]: (prev[keyword] || PAGE_SIZE) + PAGE_SIZE,
    }));
  };

  const handleClearResults = useCallback(() => {
    setResultsByKeyword({});
    setSearchedKeywords([]);
    setVisibleCounts({});
    setActiveTab("");
    setShowDangerOnly(false);
    setError(null);
  }, []);

  const handleRemoveKeyword = useCallback((kw: string) => {
    setResultsByKeyword((prev) => {
      const next = { ...prev };
      delete next[kw];
      return next;
    });
    setVisibleCounts((prev) => {
      const next = { ...prev };
      delete next[kw];
      return next;
    });
    setSearchedKeywords((prev) => {
      const remaining = prev.filter((k) => k !== kw);
      if (remaining.length === 0) {
        setActiveTab("");
      } else if (kw === activeTab) {
        setActiveTab(remaining[0]);
      }
      return remaining;
    });
  }, [activeTab]);

  const currentResults = activeTab ? (resultsByKeyword[activeTab] || []) : [];
  const currentVisible = visibleCounts[activeTab] || PAGE_SIZE;

  const filteredResults = useMemo(() => {
    let items = currentResults;
    if (showDangerOnly) {
      items = items.filter(
        (r) =>
          matchNegativeKeywords(r.title, negativeKeywords).length > 0 ||
          matchNegativeKeywords(r.content, negativeKeywords).length > 0
      );
    }
    return items;
  }, [currentResults, showDangerOnly, negativeKeywords]);

  const displayResults = filteredResults.slice(0, currentVisible);
  const hasMore = filteredResults.length > currentVisible;

  const dangerCount = currentResults.filter(
    (r) =>
      matchNegativeKeywords(r.title, negativeKeywords).length > 0 ||
      matchNegativeKeywords(r.content, negativeKeywords).length > 0
  ).length;

  const searched = searchedKeywords.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Search Input */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-[#03C75A] text-xs font-bold text-white">N</span>
            <CardTitle className="text-lg text-card-foreground">네이버 블로그 검색</CardTitle>
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
                placeholder={`검색어 입력 (예: ${DEFAULT_BRAND_KEYWORDS.join(", ")})`}
                className="h-10 pl-10 text-sm bg-background border-input"
              />
            </div>
            <Button onClick={() => searchBlogs()} disabled={isLoading || !searchKeyword.trim()} className="h-10 gap-2">
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />검색 중...</>
              ) : (
                <><Search className="h-4 w-4" />블로그 검색</>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter로 검색. 여러 키워드는 쉼표(,)로 구분 → 각각 탭으로 결과 표시. 블로그 결과만 표시됩니다.
          </p>

          {/* Recent searches */}
          {recentSearches.length > 0 && !searched && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> 최근 검색
              </div>
              {recentSearches.map((q) => (
                <Badge
                  key={q}
                  variant="secondary"
                  className="cursor-pointer gap-1 px-2 py-1 text-xs hover:bg-accent transition-colors"
                  onClick={() => { setSearchKeyword(q); searchBlogs(q); }}
                >
                  {q}
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeRecent(q); }} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20">
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Keyword tabs + Results */}
      {searched && !isLoading && Object.keys(resultsByKeyword).length > 0 && (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-wrap items-center gap-1 mb-3">
              {searchedKeywords.map((kw) => (
                <div key={kw} className="flex items-center">
                  <TabsList className="bg-card border border-border h-auto p-0">
                    <TabsTrigger value={kw} className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <BookOpen className="h-3 w-3" />
                      {kw}
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        {resultsByKeyword[kw]?.length || 0}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(kw)}
                    className="ml-0.5 rounded-full p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
                    title={`"${kw}" 결과 지우기`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {searchedKeywords.map((kw) => (
              <TabsContent key={kw} value={kw} className="mt-0">
                {/* Stats */}
                <Card className="border-border bg-card mb-3">
                  <CardContent className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                          <CheckCircle2 className="h-3 w-3" />
                          블로그 결과: {resultsByKeyword[kw]?.length || 0}건
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        {dangerCount > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />위험 {dangerCount}건
                          </Badge>
                        )}
                        <div className="flex items-center gap-2">
                          <Switch id={`danger-${kw}`} checked={showDangerOnly} onCheckedChange={setShowDangerOnly} />
                          <Label htmlFor={`danger-${kw}`} className="text-xs text-muted-foreground cursor-pointer">위험 글만</Label>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => searchBlogs()} disabled={isLoading} className="gap-1.5 bg-transparent">
                          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />새로고침
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleClearResults} className="gap-1.5 bg-transparent text-muted-foreground hover:text-destructive hover:border-destructive/30">
                          <Trash2 className="h-3.5 w-3.5" />결과 지우기
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Results Table (outside TabsContent to avoid re-render issues) */}
          {displayResults.length > 0 && (
            <Card className="border-border bg-card">
              <CardContent className="py-4">
                <div className="rounded-lg border border-border overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground w-[250px]">제목</TableHead>
                        <TableHead className="text-muted-foreground">내용</TableHead>
                        <TableHead className="text-muted-foreground w-[110px]">작성자</TableHead>
                        <TableHead className="text-muted-foreground w-[100px]">작성일</TableHead>
                        <TableHead className="text-muted-foreground w-[80px] text-center">액션</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayResults.map((item) => {
                        const matchedTitle = matchNegativeKeywords(item.title, negativeKeywords);
                        const matchedContent = matchNegativeKeywords(item.content, negativeKeywords);
                        const allMatched = [...new Set([...matchedTitle, ...matchedContent])];
                        const isFlagged = allMatched.length > 0;
                        return (
                          <TableRow key={item.id} className={`border-border ${isFlagged ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/30"}`}>
                            <TableCell className="text-sm font-medium text-foreground align-top">
                              <span className="line-clamp-2">{highlightKeywords(item.title, searchedKeywords)}</span>
                            </TableCell>
                            <TableCell className="text-sm text-secondary-foreground align-top">
                              <div className="flex flex-col gap-1">
                                <span className="line-clamp-2 max-w-[350px]">{highlightKeywords(item.content, searchedKeywords)}</span>
                                {isFlagged && (
                                  <div className="flex flex-wrap gap-1">
                                    {allMatched.map((kw) => (
                                      <Badge key={kw} variant="destructive" className="text-[10px] gap-1">
                                        <AlertTriangle className="h-2.5 w-2.5" />{kw}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground align-top">
                              {item.authorUrl ? (
                                <a href={item.authorUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors underline decoration-muted-foreground/30">
                                  <span className="max-w-[100px] truncate block">{item.author}</span>
                                </a>
                              ) : (
                                <span className="max-w-[100px] truncate block">{item.author}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground align-top">{formatDate(item.publishedAt)}</TableCell>
                            <TableCell className="text-center align-top">
                              <div className="flex items-center justify-center gap-1">
                                <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="원본 보기">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                                {isFlagged && (
                                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors" title="신고">
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

                {/* Load more */}
                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <Button variant="outline" size="sm" onClick={() => handleLoadMore(activeTab)} className="gap-1.5 bg-transparent">
                      <ChevronDown className="h-3.5 w-3.5" />
                      더 보기 ({filteredResults.length - currentVisible}건 남음)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* No results for tab */}
          {displayResults.length === 0 && !isLoading && (
            <Card className="border-border bg-card">
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Search className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">"{activeTab}" 블로그 검색 결과가 없습니다.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Initial empty state */}
      {!searched && !isLoading && (
        <Card className="border-border bg-card">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              <Search className="h-10 w-10 text-muted-foreground/40" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">검색 대기 중</p>
                <p className="text-xs text-muted-foreground/70">검색어를 입력하고 Enter 키를 눌러주세요.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
