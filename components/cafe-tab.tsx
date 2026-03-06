"use client";

import React from "react";
import { useCallback, useState, useEffect, useMemo } from "react";
import type { MonitoringItem } from "@/lib/types";
import { DEFAULT_BRAND_KEYWORDS } from "@/lib/types";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ExternalLink, Loader2, RefreshCw, Search, Coffee, Clock, X, ChevronDown, Trash2, Link2, MessageCircle, FileText } from "lucide-react";

/* ------------------------------------------------------------------ */
const RECENT_KEY = "fitcnic_cafe_recent";
const CAFE_ID_KEY = "fitcnic_cafe_target";
const MAX_RECENT = 8;
const PAGE_SIZE = 50;

type SearchMode = "article" | "comment";

function extractCafeId(input: string): string {
  if (!input.trim()) return "";
  try {
    const url = new URL(input.trim());
    const parts = url.pathname.replace(/^\//, "").split("/");
    return parts[0] || "";
  } catch {
    return input.trim().replace(/\//g, "");
  }
}

type CafeResult = {
  id: string;
  source: "naver";
  type: "cafe";
  title: string;
  content: string;
  author: string;
  link: string;
  publishedAt: string;
  cafeName: string;
  cafeUrl: string;
  commentCount: number | null;
  searchKeyword?: string;
};

type CommentResult = {
  commentId: string;
  commentText: string;
  commentAuthor: string;
  commentDate: string;
  articleId: string;
  articleTitle: string;
  articleLink: string;
};

interface CafeTabProps {
  onItemsCollected?: (items: MonitoringItem[]) => void;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

/** Highlight keyword in text by wrapping matches in <strong> */
function highlightKeyword(text: string, keyword: string): React.ReactNode {
  if (!keyword) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <strong key={i} className="text-primary bg-primary/10 px-0.5 rounded">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

export function CafeTab({ onItemsCollected }: CafeTabProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>("article");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [cafeUrl, setCafeUrl] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [resultsByKeyword, setResultsByKeyword] = useState<Record<string, CafeResult[]>>({});
  const [searchedKeywords, setSearchedKeywords] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  // Comment search state
  const [commentResults, setCommentResults] = useState<CommentResult[]>([]);
  const [commentSearched, setCommentSearched] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentProgress, setCommentProgress] = useState("");
  const [commentStats, setCommentStats] = useState<{ scannedArticles: number; scannedComments: number } | null>(null);
  const [maxArticles, setMaxArticles] = useState("500");
  const [commentVisibleCount, setCommentVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecentSearches(parsed);
      }
      const savedCafe = localStorage.getItem(CAFE_ID_KEY);
      if (savedCafe) setCafeUrl(savedCafe);
    } catch {}
  }, []);

  const handleCafeUrlChange = useCallback((value: string) => {
    setCafeUrl(value);
    try { localStorage.setItem(CAFE_ID_KEY, value); } catch {}
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

  /* ---- Article search (existing) ---- */
  const searchArticles = useCallback(async (input?: string) => {
    const raw = input ?? searchKeyword;
    const keywords = raw.split(",").map((s) => s.trim()).filter(Boolean);

    if (keywords.length === 0) {
      setError("검색어를 입력해주세요.");
      return;
    }

    saveRecent(raw.trim());
    setIsLoading(true);
    setSearched(true);
    setError(null);
    setSearchedKeywords(keywords);

    try {
      const newResults: Record<string, CafeResult[]> = {};
      const newVisibleCounts: Record<string, number> = {};

      const cafeId = extractCafeId(cafeUrl);

      for (const keyword of keywords) {
        const params = new URLSearchParams({
          keyword,
          display: cafeId ? "100" : "30",
          sort: "date",
        });
        if (cafeId) params.set("cafeId", cafeId);

        const res = await fetch(
          `/api/naver/cafe?${params.toString()}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Naver Cafe 검색 실패 (${res.status})`);
        }

        const data = await res.json();
        const items: CafeResult[] = (data.items || []).map((it: CafeResult) => ({
          ...it,
          searchKeyword: keyword,
        }));

        const seen = new Set<string>();
        newResults[keyword] = items.filter((x) => {
          if (!x.link) return false;
          if (seen.has(x.link)) return false;
          seen.add(x.link);
          return true;
        });
        newVisibleCounts[keyword] = PAGE_SIZE;
      }

      setResultsByKeyword(newResults);
      setVisibleCounts(newVisibleCounts);
      setActiveTab(keywords[0]);

      if (onItemsCollected) {
        const all: MonitoringItem[] = Object.values(newResults)
          .flat()
          .map((r) => ({
            id: r.id,
            source: "naver" as const,
            type: "cafe" as any,
            title: r.title,
            content: r.content,
            author: r.cafeName || r.author,
            link: r.link,
            publishedAt: r.publishedAt,
            matchedKeywords: [],
            isFlagged: false,
          }));
        onItemsCollected(all);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [searchKeyword, cafeUrl, saveRecent, onItemsCollected]);

  /* ---- Comment search (new) ---- */
  const searchComments = useCallback(async () => {
    const cafeId = extractCafeId(cafeUrl);
    const keyword = searchKeyword.trim();

    if (!cafeId) {
      setCommentError("댓글 검색에는 카페 URL이 필수입니다.");
      return;
    }
    if (!keyword) {
      setCommentError("검색 키워드를 입력해주세요.");
      return;
    }

    saveRecent(keyword);
    setCommentLoading(true);
    setCommentSearched(true);
    setCommentError(null);
    setCommentResults([]);
    setCommentStats(null);
    setCommentVisibleCount(PAGE_SIZE);
    setCommentProgress(`"${cafeId}" 카페 댓글 스캔 준비 중...`);

    try {
      const res = await fetch("/api/naver/cafe-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cafeId,
          keyword,
          maxArticles: parseInt(maxArticles, 10),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `댓글 검색 실패 (${res.status})`);
      }

      const data = await res.json();

      if (data.error && data.items?.length === 0) {
        setCommentError(data.error);
        return;
      }

      setCommentResults(data.items || []);
      setCommentStats({
        scannedArticles: data.scannedArticles || 0,
        scannedComments: data.scannedComments || 0,
      });
      setCommentProgress("");
    } catch (e) {
      setCommentError(e instanceof Error ? e.message : "댓글 검색 중 오류가 발생했습니다.");
    } finally {
      setCommentLoading(false);
      setCommentProgress("");
    }
  }, [cafeUrl, searchKeyword, maxArticles, saveRecent]);

  /* ---- Unified search handler ---- */
  const search = useCallback(async (input?: string) => {
    if (searchMode === "comment") {
      await searchComments();
    } else {
      await searchArticles(input);
    }
  }, [searchMode, searchComments, searchArticles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
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
    setSearched(false);
    setError(null);
    // Also clear comment results
    setCommentResults([]);
    setCommentSearched(false);
    setCommentError(null);
    setCommentStats(null);
    setCommentProgress("");
  }, []);

  const totalCount = Object.values(resultsByKeyword).reduce((sum, arr) => sum + arr.length, 0);

  // Author frequency map for comment results
  const authorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of commentResults) {
      counts[c.commentAuthor] = (counts[c.commentAuthor] || 0) + 1;
    }
    return counts;
  }, [commentResults]);

  const displayComments = commentResults.slice(0, commentVisibleCount);
  const hasMoreComments = commentResults.length > commentVisibleCount;

  const currentLoading = searchMode === "comment" ? commentLoading : isLoading;
  const currentSearched = searchMode === "comment" ? commentSearched : searched;

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Coffee className="h-5 w-5 text-[#03C75A]" />
            <CardTitle className="text-lg text-card-foreground">네이버 카페 검색</CardTitle>
            {searchMode === "article" && searched && totalCount > 0 && (
              <Badge variant="secondary" className="text-xs">총 {totalCount}건</Badge>
            )}
            {searchMode === "comment" && commentSearched && commentResults.length > 0 && (
              <Badge variant="secondary" className="text-xs">매칭 {commentResults.length}건</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 w-fit">
            <button
              type="button"
              onClick={() => setSearchMode("article")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                searchMode === "article"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              게시글 검색
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("comment")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                searchMode === "comment"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              댓글 검색
            </button>
          </div>

          {/* 특정 카페 지정 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-lg">
              <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={cafeUrl}
                onChange={(e) => handleCafeUrlChange(e.target.value)}
                placeholder={searchMode === "comment"
                  ? "카페 URL (필수, 예: https://cafe.naver.com/moneytaker)"
                  : "특정 카페 URL (예: https://cafe.naver.com/moneytaker)"
                }
                className={`h-9 pl-10 text-sm bg-background border-input ${
                  searchMode === "comment" && !cafeUrl ? "border-orange-400/50" : ""
                }`}
              />
            </div>
            {cafeUrl && (
              <button
                type="button"
                onClick={() => handleCafeUrlChange("")}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {cafeUrl && (
              <Badge variant="outline" className="text-xs whitespace-nowrap border-[#03C75A]/30 text-[#03C75A]">
                {extractCafeId(cafeUrl)}
              </Badge>
            )}
          </div>

          {/* 검색어 입력 + 댓글 모드: 스캔 범위 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={searchMode === "comment"
                  ? "댓글에서 찾을 키워드 (예: 링크, http, 홍보)"
                  : "검색어를 입력하세요."
                }
                className="h-10 pl-10 text-sm bg-background border-input"
              />
            </div>

            {searchMode === "comment" && (
              <Select value={maxArticles} onValueChange={setMaxArticles}>
                <SelectTrigger className="h-10 w-[140px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="200">최근 200개</SelectItem>
                  <SelectItem value="500">최근 500개</SelectItem>
                  <SelectItem value="1000">최근 1000개</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button onClick={() => search()} disabled={currentLoading || !searchKeyword.trim()} className="h-10 gap-2">
              {currentLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />검색 중...</>
              ) : (
                <><Search className="h-4 w-4" />{searchMode === "comment" ? "댓글 검색" : "카페 검색"}</>
              )}
            </Button>
            {currentSearched && (
              <>
                <Button variant="outline" size="sm" onClick={() => search()} disabled={currentLoading} className="h-10 gap-1.5 bg-transparent">
                  <RefreshCw className={`h-3.5 w-3.5 ${currentLoading ? "animate-spin" : ""}`} />새로고침
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearResults} className="h-10 gap-1.5 bg-transparent text-muted-foreground hover:text-destructive hover:border-destructive/30">
                  <Trash2 className="h-3.5 w-3.5" />결과 지우기
                </Button>
              </>
            )}
          </div>

          <p className="text-xs text-muted-foreground/70">
            {searchMode === "comment"
              ? `카페의 최근 ${maxArticles}개 게시글의 댓글을 스캔하여 키워드가 포함된 댓글을 찾습니다. 시간이 걸릴 수 있습니다.`
              : cafeUrl
                ? `"${extractCafeId(cafeUrl)}" 카페 내에서만 검색합니다. 최대 500건을 스캔하여 필터링합니다.`
                : "Enter로 검색. 여러 키워드는 쉼표(,)로 구분 → 각각 탭으로 결과 표시."
            }
          </p>

          {/* Recent searches */}
          {recentSearches.length > 0 && !currentSearched && (
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> 최근 검색</div>
              {recentSearches.map((q) => (
                <Badge key={q} variant="secondary" className="cursor-pointer gap-1 px-2 py-1 text-xs hover:bg-accent transition-colors" onClick={() => { setSearchKeyword(q); if (searchMode === "article") searchArticles(q); }}>
                  {q}
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeRecent(q); }} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"><X className="h-2 w-2" /></button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {(searchMode === "article" ? error : commentError) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{searchMode === "article" ? error : commentError}</p>
        </div>
      )}

      {/* Loading */}
      {currentLoading && searchMode === "article" && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      )}

      {/* Comment loading progress */}
      {commentLoading && searchMode === "comment" && (
        <Card className="border-border bg-card">
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{commentProgress || "댓글 스캔 중..."}</p>
              <div className="w-full max-w-xs">
                <Progress value={undefined} className="h-1.5" />
              </div>
              <p className="text-xs text-muted-foreground/60">
                최근 {maxArticles}개 게시글의 댓글을 수집하고 있습니다. 잠시 기다려주세요...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ==================== ARTICLE RESULTS ==================== */}
      {searchMode === "article" && searched && totalCount > 0 && !isLoading && (
        <Card className="border-border bg-card">
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

              {searchedKeywords.map((kw) => (
                <TabsContent key={kw} value={kw} className="mt-0">
                  {(resultsByKeyword[kw]?.length || 0) === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">&quot;{kw}&quot; 카페 검색 결과가 없습니다.</div>
                  ) : (
                    <>
                      <div className="rounded-lg border border-border overflow-auto max-h-[650px]">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                              <TableHead className="text-muted-foreground w-[260px]">제목</TableHead>
                              <TableHead className="text-muted-foreground">내용</TableHead>
                              <TableHead className="text-muted-foreground w-[160px]">카페</TableHead>
                              <TableHead className="text-muted-foreground w-[90px] text-center">댓글</TableHead>
                              <TableHead className="text-muted-foreground w-[160px]">수집일</TableHead>
                              <TableHead className="text-muted-foreground w-[60px] text-center">링크</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(resultsByKeyword[kw] || []).slice(0, visibleCounts[kw] || PAGE_SIZE).map((item) => (
                              <TableRow key={item.id} className="border-border hover:bg-muted/30">
                                <TableCell className="text-sm font-medium text-foreground align-top">
                                  <span className="line-clamp-2">{item.title}</span>
                                  {item.cafeUrl && <div className="mt-1 text-[11px] text-muted-foreground truncate">{item.cafeUrl}</div>}
                                </TableCell>
                                <TableCell className="text-sm text-secondary-foreground align-top">
                                  <span className="line-clamp-2 max-w-[420px] block">{item.content}</span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground align-top">
                                  <span className="line-clamp-2">{item.cafeName || item.author}</span>
                                </TableCell>
                                <TableCell className="text-center align-top">
                                  <Badge variant="secondary" className="text-xs">{item.commentCount ?? "\u2014"}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground align-top">{formatDate(item.publishedAt)}</TableCell>
                                <TableCell className="text-center align-top">
                                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {(resultsByKeyword[kw]?.length || 0) > (visibleCounts[kw] || PAGE_SIZE) && (
                        <div className="flex justify-center mt-4">
                          <Button variant="outline" size="sm" onClick={() => handleLoadMore(kw)} className="gap-1.5 bg-transparent">
                            <ChevronDown className="h-3.5 w-3.5" />
                            더 보기 ({(resultsByKeyword[kw]?.length || 0) - (visibleCounts[kw] || PAGE_SIZE)}건 남음)
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* ==================== COMMENT RESULTS ==================== */}
      {searchMode === "comment" && commentSearched && !commentLoading && (
        <>
          {/* Stats bar */}
          {commentStats && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>스캔 게시글: <strong className="text-foreground">{commentStats.scannedArticles.toLocaleString()}</strong>개</span>
              <span>스캔 댓글: <strong className="text-foreground">{commentStats.scannedComments.toLocaleString()}</strong>개</span>
              <span>매칭: <strong className="text-primary">{commentResults.length}</strong>건</span>
            </div>
          )}

          {commentResults.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="py-8">
                <div className="flex flex-col items-center gap-3 text-center">
                  <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    &quot;{searchKeyword}&quot; 키워드가 포함된 댓글이 없습니다.
                  </p>
                  {commentStats && (
                    <p className="text-xs text-muted-foreground/60">
                      {commentStats.scannedArticles}개 게시글, {commentStats.scannedComments}개 댓글을 스캔했습니다.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border bg-card">
              <CardContent className="pt-4">
                <div className="rounded-lg border border-border overflow-auto max-h-[650px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">댓글 내용</TableHead>
                        <TableHead className="text-muted-foreground w-[120px]">작성자</TableHead>
                        <TableHead className="text-muted-foreground w-[220px]">게시글 제목</TableHead>
                        <TableHead className="text-muted-foreground w-[150px]">작성일</TableHead>
                        <TableHead className="text-muted-foreground w-[60px] text-center">링크</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayComments.map((item, idx) => (
                        <TableRow key={`${item.commentId}-${idx}`} className="border-border hover:bg-muted/30">
                          <TableCell className="text-sm text-foreground align-top">
                            <span className="block max-w-[500px]">
                              {highlightKeyword(item.commentText, searchKeyword)}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground align-top">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[80px]">{item.commentAuthor || "-"}</span>
                              {authorCounts[item.commentAuthor] > 1 && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 border-orange-400/40 text-orange-400">
                                  {authorCounts[item.commentAuthor]}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground align-top">
                            <a
                              href={item.articleLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="line-clamp-2 hover:text-foreground transition-colors hover:underline"
                            >
                              {item.articleTitle || `게시글 #${item.articleId}`}
                            </a>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground align-top">
                            {formatDate(item.commentDate)}
                          </TableCell>
                          <TableCell className="text-center align-top">
                            <a href={item.articleLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {hasMoreComments && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCommentVisibleCount((prev) => prev + PAGE_SIZE)}
                      className="gap-1.5 bg-transparent"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                      더 보기 ({commentResults.length - commentVisibleCount}건 남음)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty state */}
      {!currentSearched && !currentLoading && (
        <Card className="border-border bg-card">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-3 text-center">
              {searchMode === "comment" ? (
                <>
                  <MessageCircle className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">카페 URL과 키워드를 입력하여 댓글 검색을 시작하세요.</p>
                  <p className="text-xs text-muted-foreground/60">공개 카페의 게시글 댓글을 스캔하여 키워드가 포함된 댓글을 찾습니다.</p>
                </>
              ) : (
                <>
                  <Search className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">검색어를 입력하여 네이버 카페 검색을 시작하세요.</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
