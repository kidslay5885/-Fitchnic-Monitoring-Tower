"use client";

import React from "react";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  ThumbsUp,
  MessageSquareReply,
  FileSpreadsheet,
  ChevronDown,
  Flag,
  AlertTriangle,
  X,
} from "lucide-react";
import type { CommentRecord } from "@/lib/types";
import { DEFAULT_NEGATIVE_KEYWORDS } from "@/lib/types";

const PAGE_SIZE = 50;

interface ResultsTableProps {
  videoId: string;
  totalComments: number;
  isDone: boolean;
  allComments: CommentRecord[];
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

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadCSV(comments: CommentRecord[], videoId: string) {
  const headers = [
    "video_id", "video_url", "comment_id", "thread_id", "parent_id",
    "is_reply", "author_display_name", "author_channel_id",
    "author_profile_url", "text_original", "text_plain", "like_count",
    "published_at", "updated_at", "fetched_at", "source",
  ];
  const rows = comments.map((c) =>
    [
      escapeCSV(c.video_id), escapeCSV(c.video_url), escapeCSV(c.comment_id),
      escapeCSV(c.thread_id), escapeCSV(c.parent_id || ""),
      c.is_reply ? "true" : "false", escapeCSV(c.author_display_name),
      escapeCSV(c.author_channel_id), escapeCSV(c.author_profile_url),
      escapeCSV(c.text_original), escapeCSV(c.text_plain),
      String(c.like_count), escapeCSV(c.published_at),
      escapeCSV(c.updated_at), escapeCSV(c.fetched_at), escapeCSV(c.source),
    ].join(",")
  );
  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  a.href = url;
  a.download = `${videoId}_${date}_comments.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSONL(comments: CommentRecord[], videoId: string) {
  const jsonl = comments.map((c) => JSON.stringify(c)).join("\n");
  const blob = new Blob([jsonl], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  a.href = url;
  a.download = `${videoId}_${date}_comments.jsonl`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsTable({
  videoId,
  totalComments,
  isDone,
  allComments,
}: ResultsTableProps) {
  const [search, setSearch] = useState("");
  const [author, setAuthor] = useState("");
  const [repliesOnly, setRepliesOnly] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Negative keywords management
  const [negativeKeywords, setNegativeKeywords] = useState<string[]>(
    () => [...DEFAULT_NEGATIVE_KEYWORDS]
  );
  const [newKeyword, setNewKeyword] = useState("");

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (kw && !negativeKeywords.includes(kw)) {
      setNegativeKeywords((prev) => [...prev, kw]);
    }
    setNewKeyword("");
  };

  const removeKeyword = (kw: string) => {
    setNegativeKeywords((prev) => prev.filter((k) => k !== kw));
  };

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = allComments;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.text_plain.toLowerCase().includes(lower) ||
          c.text_original.toLowerCase().includes(lower)
      );
    }
    if (author) {
      const lower = author.toLowerCase();
      result = result.filter((c) =>
        c.author_display_name.toLowerCase().includes(lower)
      );
    }
    if (repliesOnly) {
      result = result.filter((c) => c.is_reply);
    }
    return result;
  }, [allComments, search, author, repliesOnly]);

  const displayComments = useMemo(() => {
    const base = flaggedOnly
      ? filtered.filter((c) => matchesNegativeKeywords(c.text_plain, negativeKeywords) !== null)
      : filtered;
    return base.slice(0, visibleCount);
  }, [filtered, flaggedOnly, negativeKeywords, visibleCount]);

  const totalFiltered = flaggedOnly
    ? filtered.filter((c) => matchesNegativeKeywords(c.text_plain, negativeKeywords) !== null).length
    : filtered.length;

  const flaggedCount = filtered.filter(
    (c) => matchesNegativeKeywords(c.text_plain, negativeKeywords) !== null
  ).length;

  const handleSearch = () => {
    setVisibleCount(PAGE_SIZE);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  if (!isDone || totalComments === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Negative keywords card */}
      <Card className="border-destructive/30 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-card-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            부정어 필터
            {flaggedCount > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">
                {flaggedCount}건 감지
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {negativeKeywords.map((kw) => (
                <Badge
                  key={kw}
                  variant="outline"
                  className="border-destructive/40 text-destructive gap-1 pr-1"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => removeKeyword(kw)}
                    className="rounded-sm hover:bg-destructive/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="부정어 추가..."
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addKeyword();
                  }
                }}
                className="max-w-xs bg-secondary text-secondary-foreground border-input placeholder:text-muted-foreground"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addKeyword}
                disabled={!newKeyword.trim()}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 bg-transparent"
              >
                추가
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results card */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg text-card-foreground">
              수집 결과 ({totalFiltered.toLocaleString()}건)
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCSV(allComments, videoId)}
                className="border-input bg-secondary text-secondary-foreground hover:bg-muted"
              >
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadJSONL(allComments, videoId)}
                className="border-input bg-secondary text-secondary-foreground hover:bg-muted"
              >
                CSV 대신 JSONL
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="키워드 검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-9 bg-secondary text-secondary-foreground border-input placeholder:text-muted-foreground"
                  />
                </div>
                <Input
                  placeholder="작성자 필터"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-40 bg-secondary text-secondary-foreground border-input placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={repliesOnly}
                    onCheckedChange={(v) => {
                      setRepliesOnly(v);
                      setVisibleCount(PAGE_SIZE);
                    }}
                  />
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">
                    대댓글만
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={flaggedOnly}
                    onCheckedChange={(v) => {
                      setFlaggedOnly(v);
                      setVisibleCount(PAGE_SIZE);
                    }}
                  />
                  <Label className="text-sm text-destructive whitespace-nowrap">
                    위험 댓글만
                  </Label>
                </div>
                <Button size="sm" variant="secondary" onClick={handleSearch}>
                  <Search className="mr-1.5 h-3.5 w-3.5" />
                  검색
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border overflow-auto max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground w-[130px]">
                      작성자
                    </TableHead>
                    <TableHead className="text-muted-foreground">
                      댓글 내용
                    </TableHead>
                    <TableHead className="text-muted-foreground w-[60px] text-center">
                      <ThumbsUp className="inline h-3.5 w-3.5" />
                    </TableHead>
                    <TableHead className="text-muted-foreground w-[120px]">
                      작성일
                    </TableHead>
                    <TableHead className="text-muted-foreground w-[70px] text-center">
                      유형
                    </TableHead>
                    <TableHead className="text-muted-foreground w-[70px] text-center">
                      신고
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayComments.map((c) => {
                    const matchedKw = matchesNegativeKeywords(
                      c.text_plain,
                      negativeKeywords
                    );
                    const isFlagged = matchedKw !== null;

                    return (
                      <TableRow
                        key={c.comment_id}
                        className={`border-border ${
                          isFlagged
                            ? "bg-destructive/5 hover:bg-destructive/10"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        <TableCell className="text-sm font-medium text-foreground align-top">
                          <div className="flex flex-col gap-1">
                            <span className="max-w-[130px] truncate">
                              {c.author_display_name}
                            </span>
                            {c.author_channel_id && (
                              <a
                                href={`https://www.youtube.com/channel/${c.author_channel_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-muted-foreground hover:text-primary truncate max-w-[130px]"
                              >
                                {c.author_channel_id.slice(0, 16)}...
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-secondary-foreground align-top">
                          <div className="flex flex-col gap-1.5">
                            <div className="whitespace-pre-wrap max-w-[450px] break-words">
                              {c.text_plain}
                            </div>
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
                        <TableCell className="text-sm text-center text-muted-foreground align-top">
                          {c.like_count > 0
                            ? c.like_count.toLocaleString()
                            : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground align-top">
                          {formatDate(c.published_at)}
                        </TableCell>
                        <TableCell className="text-center align-top">
                          {c.is_reply ? (
                            <Badge variant="secondary" className="text-xs">
                              <MessageSquareReply className="mr-1 h-3 w-3" />
                              답글
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              원글
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center align-top">
                          <a
                            href={`https://www.youtube.com/watch?v=${videoId}&lc=${c.comment_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                              isFlagged
                                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                : "bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground"
                            }`}
                            title="YouTube에서 해당 댓글로 이동하여 신고"
                          >
                            <Flag className="h-3 w-3 mr-1" />
                            신고
                          </a>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {displayComments.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground py-8"
                      >
                        {flaggedOnly
                          ? "부정어에 해당하는 댓글이 없습니다."
                          : "검색 결과가 없습니다."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Load more */}
            {visibleCount < totalFiltered && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="border-input bg-secondary text-secondary-foreground hover:bg-muted"
                >
                  <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
                  더 보기 ({Math.min(PAGE_SIZE, totalFiltered - visibleCount)}건)
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
