import { NextResponse } from "next/server";

function stripHtml(input: string) {
  if (!input) return "";
  const noTags = input.replace(/<[^>]*>/g, "");
  // 최소한의 HTML entity 디코딩
  return noTags
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}


async function fetchCafePage(
  keyword: string,
  display: number,
  start: number,
  sort: string,
  clientId: string,
  clientSecret: string
) {
  const url = new URL("https://openapi.naver.com/v1/search/cafearticle.json");
  url.searchParams.set("query", keyword);
  url.searchParams.set("display", String(display));
  url.searchParams.set("start", String(start));
  url.searchParams.set("sort", sort);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Naver Cafe API 오류: ${res.status} ${body}`);
  }

  return res.json();
}

// cafeId(URL 슬러그)로부터 카페 표시명 + 핵심 키워드 추출
async function resolveCafeKeywords(
  cafeId: string,
  clientId: string,
  clientSecret: string
): Promise<{ fullName: string; brandWord: string }> {
  try {
    const data = await fetchCafePage(cafeId, 5, 1, "date", clientId, clientSecret);
    const items = data.items || [];
    const match = items.find(
      (item: any) => (item.cafeurl || "").toLowerCase().includes(cafeId.toLowerCase())
    );
    if (match?.cafename) {
      // 괄호 앞의 이름: "핏크닉 연구소 (부업/투잡/...)" → "핏크닉 연구소"
      const fullName = stripHtml(match.cafename).split(/[(\[（]/)[0].trim();
      // 첫 단어 (브랜드 핵심 키워드): "핏크닉 연구소" → "핏크닉"
      const brandWord = fullName.split(/\s+/)[0] || "";
      return { fullName, brandWord };
    }
  } catch {}
  return { fullName: "", brandWord: "" };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const keyword = searchParams.get("keyword") ?? searchParams.get("query");
  const display = clamp(parseInt(searchParams.get("display") || "30", 10), 1, 100);
  const start = clamp(parseInt(searchParams.get("start") || "1", 10), 1, 1000);
  const sort = (searchParams.get("sort") || "date").toLowerCase() === "sim" ? "sim" : "date";
  const cafeId = searchParams.get("cafeId"); // e.g. "moneytaker"

  if (!keyword) {
    return NextResponse.json({ error: "keyword 파라미터가 필요합니다." }, { status: 400 });
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  try {
    const observedAt = new Date().toISOString();

    // 특정 카페 필터링 모드
    if (cafeId) {
      const cafeIdLower = cafeId.toLowerCase();
      const matchesCafe = (item: any) =>
        (item.cafeurl || "").toLowerCase().includes(cafeIdLower);

      const toResult = (item: any, idx: number) => ({
        id: `naver-cafe-${encodeURIComponent(keyword)}-${cafeId}-${idx}-${item.link}`,
        source: "naver" as const,
        type: "cafe" as const,
        title: stripHtml(item.title || ""),
        content: stripHtml(item.description || ""),
        author: stripHtml(item.cafename || ""),
        link: item.link || "",
        publishedAt: "",
        cafeName: stripHtml(item.cafename || ""),
        cafeUrl: item.cafeurl || "",
        commentCount: null as number | null,
      });

      // 1단계: cafeId → 카페 브랜드 키워드 조회
      const { fullName: cafeName, brandWord } = await resolveCafeKeywords(cafeId, clientId, clientSecret);

      // 2단계: 브랜드키워드+검색어 조합으로 검색 (정확도 높은 순서)
      const cafeQueries: string[] = [];
      if (brandWord) {
        // "핏크닉 사기" — 가장 정확한 결과
        cafeQueries.push(`${brandWord} ${keyword}`);
      }
      if (cafeName && cafeName !== brandWord) {
        // "핏크닉 연구소 사기" — 보조 검색
        cafeQueries.push(`${cafeName} ${keyword}`);
      }
      // 키워드 단독 검색 (fallback — 결과를 cafeurl로 필터링)
      cafeQueries.push(keyword);

      const cafeRaw: any[] = [];
      for (const q of cafeQueries) {
        const pageSize = 100;
        const maxPages = 10; // 네이버 API 한도: start ≤ 1000 → 최대 1000건/쿼리
        for (let page = 0; page < maxPages; page++) {
          const pageStart = 1 + page * pageSize;
          if (pageStart > 1000) break;
          try {
            const data = await fetchCafePage(q, pageSize, pageStart, sort, clientId, clientSecret);
            const pageItems = data.items || [];
            cafeRaw.push(...pageItems);
            if (pageItems.length < pageSize) break;
          } catch {
            break;
          }
        }
      }

      // 해당 카페 결과만 필터 + 키워드 본문 포함 확인 + 중복 제거
      const kwLower = keyword.toLowerCase();
      const seen = new Set<string>();
      const filtered = cafeRaw
        .filter(matchesCafe)
        .filter((item: any) => {
          // 제목 또는 본문에 실제 키워드가 포함된 결과만 유지
          const title = stripHtml(item.title || "").toLowerCase();
          const desc = stripHtml(item.description || "").toLowerCase();
          return title.includes(kwLower) || desc.includes(kwLower);
        })
        .filter((item: any) => {
          const link = (item.link || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
          if (!link) return false;
          if (seen.has(link)) return false;
          seen.add(link);
          return true;
        })
        .map(toResult);

      return NextResponse.json({
        total: filtered.length,
        observedAt,
        cafeId,
        cafeName: cafeName || brandWord || null,
        scannedTotal: cafeRaw.length,
        items: filtered,
      });
    }

    // 일반 모드: 기존 동작
    const data = await fetchCafePage(keyword, display, start, sort, clientId, clientSecret);

    const kwLower = keyword.toLowerCase();
    const items =
      (data.items || [])
        .filter((item: any) => {
          // 제목 또는 본문에 실제 키워드가 포함된 결과만 유지
          const title = stripHtml(item.title || "").toLowerCase();
          const desc = stripHtml(item.description || "").toLowerCase();
          return title.includes(kwLower) || desc.includes(kwLower);
        })
        .map((item: any, idx: number) => ({
          id: `naver-cafe-${encodeURIComponent(keyword)}-${start + idx}-${item.link}`,
          source: "naver" as const,
          type: "cafe" as const,
          title: stripHtml(item.title || ""),
          content: stripHtml(item.description || ""),
          author: stripHtml(item.cafename || ""),
          link: item.link || "",
          publishedAt: "",
          cafeName: stripHtml(item.cafename || ""),
          cafeUrl: item.cafeurl || "",
          commentCount: null as number | null,
        })) || [];

    return NextResponse.json({
      total: data.total ?? items.length,
      observedAt,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Naver Cafe 검색 실패: ${message}` }, { status: 500 });
  }
}
