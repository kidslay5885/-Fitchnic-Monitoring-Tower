"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { History, Pencil, Check, X } from "lucide-react";
import type { JobStatus } from "@/lib/types";

interface JobSummary {
  id: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  status: JobStatus;
  progress: { pages: number; comments: number };
  createdAt: string;
  commentCount: number;
}

interface JobHistoryProps {
  jobs: JobSummary[];
  activeJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onTitleChange: (jobId: string, newTitle: string) => void;
}

const statusLabels: Record<JobStatus, string> = {
  queued: "대기",
  running: "수집 중",
  done: "완료",
  error: "오류",
};

const statusVariants: Record<
  JobStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  queued: "secondary",
  running: "default",
  done: "outline",
  error: "destructive",
};

export function JobHistory({
  jobs,
  activeJobId,
  onSelectJob,
  onTitleChange,
}: JobHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  if (jobs.length === 0) return null;

  const startEdit = (jobId: string, currentTitle: string) => {
    setEditingId(jobId);
    setEditValue(currentTitle);
  };

  const confirmEdit = (jobId: string) => {
    if (editValue.trim()) {
      onTitleChange(jobId, editValue.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-card-foreground">
          <History className="h-5 w-5 text-muted-foreground" />
          수집 이력
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={`flex flex-col gap-2 rounded-lg border p-3 transition-colors ${
                activeJobId === job.id
                  ? "border-primary/50 bg-primary/5"
                  : "border-border bg-muted/20 hover:bg-muted/40"
              }`}
            >
              <div
                className="flex items-start justify-between gap-2 cursor-pointer"
                onClick={() => {
                  if (editingId !== job.id) {
                    onSelectJob(job.id);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editingId !== job.id) {
                    onSelectJob(job.id);
                  }
                }}
              >
                <div className="flex flex-1 flex-col gap-1 text-left">
                  {editingId === job.id ? (
                    <div
                      className="flex items-center gap-1.5 w-full"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") confirmEdit(job.id);
                        if (e.key === "Escape") cancelEdit();
                      }}
                    >
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="h-7 text-sm bg-secondary border-input text-foreground"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          confirmEdit(job.id);
                        }}
                        className="rounded p-1 text-primary hover:bg-primary/10"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEdit();
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground line-clamp-1">
                        {job.videoTitle}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(job.id, job.videoTitle);
                        }}
                        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {job.videoId} &middot;{" "}
                    {new Date(job.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {job.commentCount.toLocaleString()}건
                  </span>
                  <Badge
                    variant={statusVariants[job.status]}
                    className="text-xs"
                  >
                    {statusLabels[job.status]}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
