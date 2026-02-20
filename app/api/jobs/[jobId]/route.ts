import { NextResponse } from "next/server";
import { getJob, setJob } from "@/lib/job-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json(
      { error: "Job을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    id: job.id,
    videoId: job.videoId,
    videoUrl: job.videoUrl,
    videoTitle: job.videoTitle,
    status: job.status,
    progress: job.progress,
    error: job.error,
    createdAt: job.createdAt,
    commentCount: job.comments.length,
    order: job.order,
    maxPages: job.maxPages,
    includeReplies: job.includeReplies,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json(
      { error: "Job을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const body = await request.json();

  if (typeof body.videoTitle === "string") {
    job.videoTitle = body.videoTitle.trim() || job.videoTitle;
  }

  setJob(job);

  return NextResponse.json({ success: true, videoTitle: job.videoTitle });
}
