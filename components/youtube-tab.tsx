"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CollectForm } from "@/components/collect-form";
import { ProgressCard } from "@/components/progress-card";
import { ResultsTable } from "@/components/results-table";
import { JobHistory } from "@/components/job-history";
import type { MonitoringItem } from "@/lib/types";

interface JobData {
  id: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  status: "queued" | "running" | "done" | "error";
  progress: { pages: number; comments: number; currentPage: string };
  error?: string;
  createdAt: string;
  commentCount: number;
}

interface YouTubeTabProps {
  onCommentsCollected?: (items: MonitoringItem[]) => void;
}

export function YouTubeTab({ onCommentsCollected }: YouTubeTabProps) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<JobData | null>(null);
  const [jobs, setJobs] = useState<JobData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const reportedJobsRef = useRef<Set<string>>(new Set());
  // Key to force ResultsTable remount when switching jobs
  const [resultsKey, setResultsKey] = useState(0);

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const data: JobData = await res.json();
        setActiveJob(data);

        setJobs((prev) =>
          prev.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  status: data.status,
                  progress: data.progress,
                  error: data.error,
                  commentCount: data.commentCount,
                  videoTitle: data.videoTitle || j.videoTitle,
                  videoId: data.videoId || j.videoId,
                }
              : j
          )
        );

        if (data.status === "done" || data.status === "error") {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          if (
            data.status === "done" &&
            onCommentsCollected &&
            !reportedJobsRef.current.has(jobId)
          ) {
            reportedJobsRef.current.add(jobId);
            fetchAndReportComments(jobId, data.videoId, data.videoTitle);
          }
        }
      } catch {
        // Silently retry on next poll
      }
    },
    [onCommentsCollected]
  );

  const fetchAndReportComments = async (
    jobId: string,
    videoId: string,
    videoTitle: string
  ) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/results?cursor=0`);
      if (!res.ok) return;
      const data = await res.json();

      const items: MonitoringItem[] = data.data.map(
        (c: {
          comment_id: string;
          text_plain: string;
          author_display_name: string;
          author_channel_id: string;
          published_at: string;
        }) => ({
          id: `yt-${c.comment_id}`,
          source: "youtube" as const,
          type: "comment" as const,
          title: videoTitle,
          content: c.text_plain,
          author: c.author_display_name,
          authorUrl: c.author_channel_id
            ? `https://www.youtube.com/channel/${c.author_channel_id}`
            : undefined,
          link: `https://www.youtube.com/watch?v=${videoId}&lc=${c.comment_id}`,
          publishedAt: c.published_at,
          matchedKeywords: [],
          isFlagged: false,
        })
      );

      onCommentsCollected?.(items);
    } catch {
      // Silently fail
    }
  };

  const startPolling = useCallback(
    (jobId: string) => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      pollJob(jobId);
      pollingRef.current = setInterval(() => pollJob(jobId), 1500);
    },
    [pollJob]
  );

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleSubmit = async (data: {
    url: string;
    order: "time" | "relevance";
    maxPages: number;
    includeReplies: boolean;
  }) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setSubmitError(result.error || "요청 실패");
        return;
      }

      const newJob: JobData = {
        id: result.jobId,
        videoId: "",
        videoUrl: data.url,
        videoTitle: "제목 불러오는 중...",
        status: "queued",
        progress: { pages: 0, comments: 0, currentPage: "대기 중..." },
        createdAt: new Date().toISOString(),
        commentCount: 0,
      };

      // Switch to new job immediately - clears previous results
      setActiveJobId(result.jobId);
      setActiveJob(newJob);
      setResultsKey((k) => k + 1); // Force ResultsTable remount
      setJobs((prev) => [newJob, ...prev]);
      startPolling(result.jobId);
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectJob = (jobId: string) => {
    // Stop current polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    setActiveJobId(jobId);
    setResultsKey((k) => k + 1); // Force ResultsTable remount to load this job's results

    const job = jobs.find((j) => j.id === jobId);
    if (job) {
      setActiveJob(job);
      if (job.status === "running" || job.status === "queued") {
        startPolling(jobId);
      }
    }
  };

  const handleTitleChange = async (jobId: string, newTitle: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, videoTitle: newTitle } : j))
    );
    if (activeJob?.id === jobId) {
      setActiveJob((prev) => (prev ? { ...prev, videoTitle: newTitle } : prev));
    }

    try {
      await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoTitle: newTitle }),
      });
    } catch {
      // Silently fail
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
          status={activeJob.status}
          pages={activeJob.progress.pages}
          comments={activeJob.progress.comments}
          currentPage={activeJob.progress.currentPage}
          error={activeJob.error}
          videoId={activeJob.videoId || "(로딩 중...)"}
          videoTitle={activeJob.videoTitle}
        />
      )}

      {activeJob && activeJobId && (
        <ResultsTable
          key={resultsKey}
          jobId={activeJobId}
          videoId={activeJob.videoId}
          totalComments={activeJob.commentCount}
          isDone={activeJob.status === "done"}
        />
      )}

      <JobHistory
        jobs={jobs}
        activeJobId={activeJobId}
        onSelectJob={handleSelectJob}
        onTitleChange={handleTitleChange}
      />
    </div>
  );
}
