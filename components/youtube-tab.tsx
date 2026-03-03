"use client";

import { useState } from "react";
import { CollectForm } from "@/components/collect-form";
import { ProgressCard } from "@/components/progress-card";
import { ResultsTable } from "@/components/results-table";
import { JobHistory } from "@/components/job-history";
import type { MonitoringItem, CommentRecord } from "@/lib/types";

interface JobData {
  id: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  status: "running" | "done" | "error";
  commentCount: number;
  error?: string;
  createdAt: string;
  comments: CommentRecord[];
}

interface YouTubeTabProps {
  onCommentsCollected?: (items: MonitoringItem[]) => void;
}

let jobCounter = 0;

export function YouTubeTab({ onCommentsCollected }: YouTubeTabProps) {
  const [activeJob, setActiveJob] = useState<JobData | null>(null);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultsKey, setResultsKey] = useState(0);

  const handleSubmit = async (data: {
    url: string;
    order: "time" | "relevance";
    maxPages: number;
    includeReplies: boolean;
  }) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const tempId = `job_${Date.now()}_${++jobCounter}`;
    const tempJob: JobData = {
      id: tempId,
      videoId: "",
      videoUrl: data.url,
      videoTitle: "",
      status: "running",
      commentCount: 0,
      createdAt: new Date().toISOString(),
      comments: [],
    };
    setActiveJob(tempJob);
    setResultsKey((k) => k + 1);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        const errorJob: JobData = {
          ...tempJob,
          status: "error",
          error: result.error || "수집 실패",
        };
        setActiveJob(errorJob);
        setSubmitError(result.error || "수집 실패");
        return;
      }

      const doneJob: JobData = {
        id: tempId,
        videoId: result.videoId,
        videoUrl: data.url,
        videoTitle: result.videoTitle,
        status: "done",
        commentCount: result.commentCount,
        createdAt: new Date().toISOString(),
        comments: result.comments || [],
      };

      setActiveJob(doneJob);
      setJobs((prev) => [doneJob, ...prev]);
      setResultsKey((k) => k + 1);

      // 대시보드에 전달
      if (onCommentsCollected && result.comments) {
        const items: MonitoringItem[] = result.comments.map(
          (c: CommentRecord) => ({
            id: `yt-${c.comment_id}`,
            source: "youtube" as const,
            type: "comment" as const,
            title: result.videoTitle,
            content: c.text_plain,
            author: c.author_display_name,
            authorUrl: c.author_channel_id
              ? `https://www.youtube.com/channel/${c.author_channel_id}`
              : undefined,
            link: `https://www.youtube.com/watch?v=${result.videoId}&lc=${c.comment_id}`,
            publishedAt: c.published_at,
            matchedKeywords: [],
            isFlagged: false,
          })
        );
        onCommentsCollected(items);
      }
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.");
      setActiveJob((prev) =>
        prev ? { ...prev, status: "error", error: "네트워크 오류" } : prev
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectJob = (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      setActiveJob(job);
      setResultsKey((k) => k + 1);
    }
  };

  const handleTitleChange = (jobId: string, newTitle: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, videoTitle: newTitle } : j))
    );
    if (activeJob?.id === jobId) {
      setActiveJob((prev) => (prev ? { ...prev, videoTitle: newTitle } : prev));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <CollectForm onSubmit={handleSubmit} isLoading={isSubmitting} />

      {submitError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{submitError}</p>
        </div>
      )}

      {activeJob && (
        <ProgressCard
          status={activeJob.status === "running" ? "running" : activeJob.status}
          pages={0}
          comments={activeJob.commentCount}
          currentPage={
            activeJob.status === "running"
              ? "댓글 수집 중... (최대 60초 소요)"
              : activeJob.status === "done"
                ? "수집 완료"
                : activeJob.error || "오류 발생"
          }
          error={activeJob.error}
          videoId={activeJob.videoId || "(수집 중...)"}
          videoTitle={activeJob.videoTitle || "제목 불러오는 중..."}
        />
      )}

      {activeJob && activeJob.status === "done" && activeJob.comments.length > 0 && (
        <ResultsTable
          key={resultsKey}
          videoId={activeJob.videoId}
          totalComments={activeJob.commentCount}
          isDone={true}
          allComments={activeJob.comments}
        />
      )}

      <JobHistory
        jobs={jobs.map((j) => ({
          id: j.id,
          videoId: j.videoId,
          videoUrl: j.videoUrl,
          videoTitle: j.videoTitle,
          status: j.status,
          progress: { pages: 0, comments: j.commentCount },
          createdAt: j.createdAt,
          commentCount: j.commentCount,
        }))}
        activeJobId={activeJob?.id || null}
        onSelectJob={handleSelectJob}
        onTitleChange={handleTitleChange}
      />
    </div>
  );
}
