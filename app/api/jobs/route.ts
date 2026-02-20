import { NextResponse } from "next/server";
import { parseVideoId, collectComments, fetchVideoTitle } from "@/lib/youtube";
import { getJob, setJob, getAllJobs, generateJobId } from "@/lib/job-store";
import type { Job } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, order = "time", maxPages = 5, includeReplies = false } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "유튜브 영상 URL을 입력해주세요." },
        { status: 400 }
      );
    }

    const videoId = parseVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "올바른 유튜브 URL이 아닙니다. (일반/공유/shorts URL 지원)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // Fetch video title
    const videoTitle = await fetchVideoTitle(videoId, apiKey);

    const jobId = generateJobId();
    const job: Job = {
      id: jobId,
      videoId,
      videoUrl: url,
      videoTitle: videoTitle || `영상 ${videoId}`,
      order,
      maxPages,
      includeReplies,
      status: "queued",
      progress: { pages: 0, comments: 0, currentPage: "대기 중..." },
      createdAt: new Date().toISOString(),
      comments: [],
    };

    setJob(job);

    // Start collection in background (non-blocking)
    processJob(job, apiKey).catch((err) => {
      const updatedJob = getJob(jobId);
      if (updatedJob) {
        updatedJob.status = "error";
        updatedJob.error = translateError(err.message);
        setJob(updatedJob);
      }
    });

    return NextResponse.json({ jobId });
  } catch {
    return NextResponse.json(
      { error: "요청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function GET() {
  const jobs = getAllJobs();
  return NextResponse.json(
    jobs.map((j) => ({
      id: j.id,
      videoId: j.videoId,
      videoUrl: j.videoUrl,
      videoTitle: j.videoTitle,
      status: j.status,
      progress: j.progress,
      error: j.error,
      createdAt: j.createdAt,
      commentCount: j.comments.length,
    }))
  );
}

async function processJob(job: Job, apiKey: string) {
  const current = getJob(job.id);
  if (!current) return;

  current.status = "running";
  current.progress.currentPage = "수집 시작...";
  setJob(current);

  const comments = await collectComments({
    videoId: current.videoId,
    videoUrl: current.videoUrl,
    apiKey,
    order: current.order,
    maxPages: current.maxPages,
    includeReplies: current.includeReplies,
    onProgress: (pages, commentCount) => {
      const running = getJob(job.id);
      if (running) {
        running.progress = {
          pages,
          comments: commentCount,
          currentPage: `페이지 ${pages} 처리 중 (${commentCount}개 수집)`,
        };
        setJob(running);
      }
    },
  });

  const finished = getJob(job.id);
  if (finished) {
    // Upsert: deduplicate by comment_id
    const existing = new Map(finished.comments.map((c) => [c.comment_id, c]));
    for (const c of comments) {
      const prev = existing.get(c.comment_id);
      if (!prev || new Date(c.updated_at) > new Date(prev.updated_at)) {
        existing.set(c.comment_id, c);
      }
    }
    finished.comments = Array.from(existing.values());
    finished.status = "done";
    finished.progress.currentPage = "수집 완료";
    finished.progress.comments = finished.comments.length;
    setJob(finished);
  }
}

function translateError(msg: string): string {
  if (msg === "COMMENTS_DISABLED")
    return "이 영상은 댓글이 비활성화되어 있습니다.";
  if (msg === "QUOTA_EXCEEDED")
    return "YouTube API 일일 할당량이 초과되었습니다. 내일 다시 시도해주세요.";
  if (msg === "VIDEO_NOT_FOUND")
    return "영상을 찾을 수 없습니다. 비공개이거나 삭제된 영상일 수 있습니다.";
  if (msg.startsWith("API_FORBIDDEN"))
    return `API 접근이 거부되었습니다: ${msg}`;
  if (msg.startsWith("API_ERROR")) return `API 오류: ${msg}`;
  return `수집 중 오류 발생: ${msg}`;
}
