import { NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";
import type { CommentRecord } from "@/lib/types";

function formatDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const M = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${y}${M}${d}${h}${m}`;
}

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function toCSV(comments: CommentRecord[]): string {
  const headers = [
    "video_id",
    "video_url",
    "comment_id",
    "thread_id",
    "parent_id",
    "is_reply",
    "author_display_name",
    "author_channel_id",
    "author_profile_url",
    "text_original",
    "text_plain",
    "like_count",
    "published_at",
    "updated_at",
    "fetched_at",
    "source",
  ];

  const rows = comments.map((c) =>
    [
      escapeCSV(c.video_id),
      escapeCSV(c.video_url),
      escapeCSV(c.comment_id),
      escapeCSV(c.thread_id),
      escapeCSV(c.parent_id || ""),
      c.is_reply ? "true" : "false",
      escapeCSV(c.author_display_name),
      escapeCSV(c.author_channel_id),
      escapeCSV(c.author_profile_url),
      escapeCSV(c.text_original),
      escapeCSV(c.text_plain),
      String(c.like_count),
      escapeCSV(c.published_at),
      escapeCSV(c.updated_at),
      escapeCSV(c.fetched_at),
      escapeCSV(c.source),
    ].join(",")
  );

  // UTF-8 BOM for Excel compatibility
  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}

function toJSONL(comments: CommentRecord[]): string {
  return comments.map((c) => JSON.stringify(c)).join("\n");
}

export async function GET(
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

  if (job.comments.length === 0) {
    return NextResponse.json(
      { error: "다운로드할 댓글이 없습니다." },
      { status: 400 }
    );
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "csv";
  const dateStr = formatDate();
  const filename = `${job.videoId}_${dateStr}_comments.${format === "jsonl" ? "jsonl" : "csv"}`;

  let content: string;
  let contentType: string;

  if (format === "jsonl") {
    content = toJSONL(job.comments);
    contentType = "application/x-ndjson";
  } else {
    content = toCSV(job.comments);
    contentType = "text/csv; charset=utf-8";
  }

  return new Response(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
