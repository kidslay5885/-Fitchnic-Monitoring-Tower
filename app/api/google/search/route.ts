import { NextResponse } from "next/server";

type ItemKind =
  | "organic"
  | "sitelink"
  | "profile"
  | "top_story"
  | "inline_image"
  | "answer_box";

type GoogleItem = {
  id: string;
  source: "google";
  type: "web";
  title: string;
  content: string;
  author: string;
  link: string;
  publishedAt: string;
  kind: ItemKind;
};

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function parseSerpDate(input?: string): string {
  if (!input) return "";
  const s = input.trim();

  const ts = Date.parse(s);
  if (!Number.isNaN(ts)) return new Date(ts).toISOString();

  const en = s.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago/i);
  if (en) {
    const n = parseInt(en[1], 10);
    const unit = en[2].toLowerCase();
    const msMap: Record<string, number> = {
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 604_800_000,
      month: 2_592_000_000,
      year: 31_536_000_000,
    };
    const ms = msMap[unit];
    return ms ? new Date(Date.now() - n * ms).toISOString() : "";
  }

  const ko = s.match(/(\d+)\s*(분|시간|일|주|개월|년)\s*전/);
  if (ko) {
    const n = parseInt(ko[1], 10);
    const unit = ko[2];
    const msMap: Record<string, number> = {
      분: 60_000,
      시간: 3_600_000,
      일: 86_400_000,
      주: 604_800_000,
      개월: 2_592_000_000,
      년: 31_536_000_000,
    };
    const ms = msMap[unit];
    return ms ? new Date(Date.now() - n * ms).toISOString() : "";
  }

  return "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get("keyword");

  const start = Math.max(0, parseInt(searchParams.get("start") || "0", 10) || 0);
  const num = Math.min(100, Math.max(5, parseInt(searchParams.get("num") || "10", 10) || 10));

  if (!keyword) {
    return NextResponse.json({ error: "keyword 파라미터가 필요합니다." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_API_KEY(SerpAPI key)가 설정되지 않았습니다." }, { status: 500 });
  }

  try {
    const url = new URL("https://serpapi.com/search");

    url.searchParams.set("engine", "google");
    url.searchParams.set("q", keyword);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("google_domain", "google.co.kr");
    url.searchParams.set("gl", "kr");
    url.searchParams.set("hl", "ko");
    url.searchParams.set("location", "Seoul, South Korea");
    url.searchParams.set("device", "desktop");
    url.searchParams.set("filter", "0");
    url.searchParams.set("num", String(num));
    url.searchParams.set("start", String(start));

    const res = await fetch(url.toString(), { cache: "no-store" });

    if (!res.ok) {
      const errorBody = await res.text();
      return NextResponse.json(
        { error: `SerpAPI 오류: ${res.status} ${errorBody}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    const items: GoogleItem[] = [];
    const seen = new Set<string>();

    const push = (it: GoogleItem) => {
      if (!it.link) return;
      if (seen.has(it.link)) return;
      seen.add(it.link);
      items.push(it);
    };

    if (data.answer_box?.link || data.answer_box?.snippet) {
      const ab = data.answer_box;
      const link = ab.link || "";
      push({
        id: `google-${keyword}-answer-${link}`,
        source: "google",
        type: "web",
        kind: "answer_box",
        title: ab.title || "Answer Box",
        content: ab.snippet || ab.answer || "",
        author: ab.source || safeHost(link),
        link,
        publishedAt: parseSerpDate(ab.date) || "",
      });
    }

    const organicResults = Array.isArray(data.organic_results) ? data.organic_results : [];
    organicResults.forEach((r: any, idx: number) => {
      const link = r.link || "";
      push({
        id: `google-${keyword}-org-${r.position ?? idx}-${link}`,
        source: "google",
        type: "web",
        kind: "organic",
        title: r.title || "",
        content: r.snippet || "",
        author: r.source || r.displayed_link || safeHost(link),
        link,
        publishedAt: parseSerpDate(r.date) || "",
      });

      const sitelinksInline = r.sitelinks?.inline || [];
      const sitelinksExpanded = r.sitelinks?.expanded || [];
      const sitelinks = [...sitelinksInline, ...sitelinksExpanded];

      sitelinks.forEach((sl: any, i: number) => {
        const slink = sl.link || "";
        if (!slink) return;
        push({
          id: `google-${keyword}-sl-${r.position ?? idx}-${i}-${slink}`,
          source: "google",
          type: "web",
          kind: "sitelink",
          title: `↳ ${sl.title || "사이트링크"}`,
          content: "",
          author: r.source || r.displayed_link || safeHost(link),
          link: slink,
          publishedAt: "",
        });
      });
    });

    const kg = data.knowledge_graph;
    if (kg?.profiles && Array.isArray(kg.profiles)) {
      kg.profiles.forEach((p: any, idx: number) => {
        const link = p.link || "";
        if (!link) return;
        push({
          id: `google-${keyword}-profile-${idx}-${link}`,
          source: "google",
          type: "web",
          kind: "profile",
          title: p.name ? `프로필: ${p.name}` : "프로필",
          content: kg.title ? `${kg.title} 관련 프로필` : "",
          author: "Knowledge Graph",
          link,
          publishedAt: "",
        });
      });
    }

    const topStoriesRaw = data.top_stories;
    let topStories: any[] = [];
    if (Array.isArray(topStoriesRaw)) {
      topStories = topStoriesRaw;
    } else if (topStoriesRaw && typeof topStoriesRaw === "object") {
      topStories = Object.values(topStoriesRaw).flatMap((v: any) => (Array.isArray(v) ? v : []));
    }

    topStories.forEach((t: any, idx: number) => {
      const link = t.link || "";
      if (!link) return;
      push({
        id: `google-${keyword}-top-${idx}-${link}`,
        source: "google",
        type: "web",
        kind: "top_story",
        title: t.title || "Top Story",
        content: "",
        author: t.source || safeHost(link),
        link,
        publishedAt: parseSerpDate(t.date) || "",
      });
    });

    const inlineImages = Array.isArray(data.inline_images) ? data.inline_images : [];
    inlineImages.forEach((img: any, idx: number) => {
      const link = img.source || img.link || "";
      if (!link) return;
      push({
        id: `google-${keyword}-img-${idx}-${link}`,
        source: "google",
        type: "web",
        kind: "inline_image",
        title: "이미지 결과",
        content: "",
        author: safeHost(img.source || "") || "Inline Images",
        link: img.source || img.link,
        publishedAt: "",
      });
    });

    return NextResponse.json({
      total: items.length,
      items,
      debug: {
        usedParams: {
          google_domain: "google.co.kr",
          gl: "kr",
          hl: "ko",
          location: "Seoul, South Korea",
          filter: 0,
          start,
          num,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Google(SerpAPI) 검색 실패: ${message}` }, { status: 500 });
  }
}
