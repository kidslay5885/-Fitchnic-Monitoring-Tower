import { NextResponse } from "next/server";
import { getJob } from "@/lib/job-store";

const PAGE_SIZE = 50;

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

  const url = new URL(request.url);
  const cursor = parseInt(url.searchParams.get("cursor") || "0", 10);
  const search = url.searchParams.get("search") || "";
  const author = url.searchParams.get("author") || "";
  const repliesOnly = url.searchParams.get("repliesOnly") === "true";

  let filtered = job.comments;

  if (search) {
    const lower = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.text_plain.toLowerCase().includes(lower) ||
        c.text_original.toLowerCase().includes(lower)
    );
  }

  if (author) {
    const lower = author.toLowerCase();
    filtered = filtered.filter((c) =>
      c.author_display_name.toLowerCase().includes(lower)
    );
  }

  if (repliesOnly) {
    filtered = filtered.filter((c) => c.is_reply);
  }

  const total = filtered.length;
  const page = filtered.slice(cursor, cursor + PAGE_SIZE);
  const nextCursor = cursor + PAGE_SIZE < total ? cursor + PAGE_SIZE : null;

  return NextResponse.json({
    data: page,
    total,
    cursor: nextCursor,
  });
}
