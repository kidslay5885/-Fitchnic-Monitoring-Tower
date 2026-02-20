"use client";

import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { JobStatus } from "@/lib/types";

interface ProgressCardProps {
  status: JobStatus;
  pages: number;
  comments: number;
  currentPage: string;
  error?: string;
  videoId: string;
  videoTitle?: string;
}

const statusConfig: Record<
  JobStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  queued: {
    label: "대기 중",
    variant: "secondary",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  running: {
    label: "수집 중",
    variant: "default",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  done: {
    label: "완료",
    variant: "outline",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  error: {
    label: "오류",
    variant: "destructive",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

export function ProgressCard({
  status,
  pages,
  comments,
  currentPage,
  error,
  videoId,
  videoTitle,
}: ProgressCardProps) {
  const config = statusConfig[status];
  const isRunning = status === "running";

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-card-foreground">
            수집 진행 상태
          </CardTitle>
          <Badge variant={config.variant} className="flex items-center gap-1.5">
            {config.icon}
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {isRunning && (
            <Progress value={undefined} className="h-2" />
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
              <span className="text-xs text-muted-foreground">영상</span>
              {videoTitle && (
                <span className="text-sm font-medium text-foreground line-clamp-1">
                  {videoTitle}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground font-mono">
                {videoId}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
              <span className="text-xs text-muted-foreground">수집 페이지</span>
              <span className="text-2xl font-bold text-foreground">
                {pages}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3">
              <span className="text-xs text-muted-foreground">수집 댓글 수</span>
              <span className="text-2xl font-bold text-primary">
                {comments.toLocaleString()}
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">{currentPage}</p>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
