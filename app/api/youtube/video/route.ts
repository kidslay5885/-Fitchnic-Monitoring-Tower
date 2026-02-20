import { NextResponse } from "next/server";
import { parseVideoId, fetchVideoDetails } from "@/lib/youtube";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const urlParam = searchParams.get("url") || searchParams.get("id");

  if (!urlParam) {
    return NextResponse.json(
      { error: "url 또는 id 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const videoId = parseVideoId(urlParam) || urlParam;

  try {
    const details = await fetchVideoDetails(videoId, apiKey);

    if (!details) {
      return NextResponse.json(
        { error: "영상을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      videoId,
      ...details,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `영상 정보 조회 실패: ${message}` },
      { status: 500 }
    );
  }
}
