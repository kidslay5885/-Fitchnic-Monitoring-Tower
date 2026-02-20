import { NextResponse } from "next/server";

interface NaverSearchItem {
  title: string;
  link: string;
  description: string;
  bloggername?: string;
  bloggerlink?: string;
  cafename?: string;
  cafeurl?: string;
  postdate: string;
}

interface NaverSearchResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverSearchItem[];
}

function stripHtml(input: string) {
  if (!input) return "";
  const noTags = input.replace(/<[^>]*>/g, "");
  return noTags
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword");
  const type = searchParams.get("type") || "blog"; // "blog" | "cafe"
  const start = parseInt(searchParams.get("start") || "1", 10);

  if (!keyword) {
    return NextResponse.json(
      { error: "keyword 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.",
      },
      { status: 500 }
    );
  }

  if (type !== "blog" && type !== "cafe") {
    return NextResponse.json(
      { error: "type은 'blog' 또는 'cafe'만 가능합니다." },
      { status: 400 }
    );
  }

  try {
    const url = new URL(`https://openapi.naver.com/v1/search/${type}.json`);
    url.searchParams.set("query", keyword);
    url.searchParams.set("display", "100");
    url.searchParams.set("start", String(Math.max(1, Math.min(start, 1000))));
    url.searchParams.set("sort", "date"); // 최신순

    const res = await fetch(url.toString(), {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!res.ok) {
      const errorBody = await res.text();
      return NextResponse.json(
        { error: `Naver API 오류: ${res.status} ${errorBody}` },
        { status: res.status }
      );
    }

    const data: NaverSearchResponse = await res.json();

    // Ensure link is always an absolute URL
    const ensureAbsoluteUrl = (url: string): string => {
      if (!url) return "";
      const trimmed = url.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }
      if (trimmed.startsWith("//")) {
        return `https:${trimmed}`;
      }
      return `https://${trimmed}`;
    };

    const items = data.items.map((item, idx) => ({
      id: `naver-${type}-${keyword}-${start + idx}-${item.postdate}`,
      source: "naver" as const,
      type,
      title: stripHtml(item.title),
      content: stripHtml(item.description),
      author:
        type === "blog"
          ? stripHtml(item.bloggername || "")
          : stripHtml(item.cafename || ""),
      authorUrl: ensureAbsoluteUrl(
        type === "blog" ? item.bloggerlink || "" : item.cafeurl || ""
      ),
      link: ensureAbsoluteUrl(item.link),
      publishedAt: formatPostDate(item.postdate),
    }));

    return NextResponse.json({
      total: data.total,
      start: data.start,
      display: data.display,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Naver 검색 실패: ${message}` },
      { status: 500 }
    );
  }
}

/**
 * Naver postdate format: "20250109" -> ISO string
 */
function formatPostDate(postdate: string): string {
  if (postdate.length === 8) {
    const y = postdate.slice(0, 4);
    const m = postdate.slice(4, 6);
    const d = postdate.slice(6, 8);
    return `${y}-${m}-${d}T00:00:00.000Z`;
  }
  return new Date().toISOString();
}
