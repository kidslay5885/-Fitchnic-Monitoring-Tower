import { NextResponse } from "next/server";
import { parseVideoId, collectComments, fetchVideoTitle } from "@/lib/youtube";

// Vercel 서버리스 함수 최대 실행 시간 (초)
export const maxDuration = 60;

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, order = "time", maxPages = 0, includeReplies = true } = body;

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

    const videoTitle = await fetchVideoTitle(videoId, apiKey);

    // 동기 수집: 완료 후 전체 댓글 반환
    const comments = await collectComments({
      videoId,
      videoUrl: url,
      apiKey,
      order,
      maxPages,
      includeReplies,
      onProgress: () => {},
    });

    return NextResponse.json({
      videoId,
      videoUrl: url,
      videoTitle: videoTitle || `영상 ${videoId}`,
      comments,
      commentCount: comments.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: translateError(msg) },
      { status: 500 }
    );
  }
}
