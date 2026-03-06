import { NextResponse } from "next/server";

export const maxDuration = 120;

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function stripHtml(input: string) {
  if (!input) return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ------------------------------------------------------------------ */
/* Step 1: Resolve clubId from cafeId (URL slug)                      */
/* ------------------------------------------------------------------ */

async function resolveClubId(cafeId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://cafe.naver.com/${cafeId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Pattern 1: clubid in iframe src or script
    const m1 = html.match(/clubid=(\d+)/i);
    if (m1) return m1[1];

    // Pattern 2: "clubId":12345
    const m2 = html.match(/"clubId"\s*:\s*(\d+)/);
    if (m2) return m2[1];

    // Pattern 3: var g_clubId = '12345'
    const m3 = html.match(/g_clubId\s*=\s*['"]?(\d+)/);
    if (m3) return m3[1];

    return null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Step 2: Fetch article list from cafe internal API                   */
/* ------------------------------------------------------------------ */

interface ArticleInfo {
  articleId: number;
  subject: string;
}

async function fetchArticleList(
  clubId: string,
  maxArticles: number
): Promise<ArticleInfo[]> {
  const perPage = 50;
  const totalPages = Math.ceil(maxArticles / perPage);
  const articles: ArticleInfo[] = [];

  for (let page = 1; page <= totalPages; page++) {
    try {
      const url = `https://apis.naver.com/cafe-web/cafe2/ArticleListV2.json?search.clubid=${clubId}&search.page=${page}&search.perPage=${perPage}&search.sortBy=date`;
      const res = await fetch(url, {
        headers: {
          Referer: `https://cafe.naver.com/`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      });

      if (!res.ok) break;
      const data = await res.json();

      const list =
        data?.message?.result?.articleList ?? data?.result?.articleList ?? [];
      if (!Array.isArray(list) || list.length === 0) break;

      for (const a of list) {
        articles.push({
          articleId: a.articleId ?? a.article_id,
          subject: stripHtml(a.subject ?? a.title ?? ""),
        });
        if (articles.length >= maxArticles) break;
      }

      if (articles.length >= maxArticles) break;
      if (list.length < perPage) break;

      await sleep(200);
    } catch {
      break;
    }
  }

  return articles;
}

/* ------------------------------------------------------------------ */
/* Step 2b: Fallback — use Naver search API for article discovery      */
/* ------------------------------------------------------------------ */

async function fetchArticleListViaSearch(
  cafeId: string,
  clientId: string,
  clientSecret: string,
  maxArticles: number
): Promise<ArticleInfo[]> {
  const articles: ArticleInfo[] = [];
  const pageSize = 100;
  const maxPages = Math.ceil(Math.min(maxArticles, 1000) / pageSize);

  for (let page = 0; page < maxPages; page++) {
    const start = 1 + page * pageSize;
    if (start > 1000) break;

    try {
      const url = new URL(
        "https://openapi.naver.com/v1/search/cafearticle.json"
      );
      url.searchParams.set("query", cafeId);
      url.searchParams.set("display", String(pageSize));
      url.searchParams.set("start", String(start));
      url.searchParams.set("sort", "date");

      const res = await fetch(url.toString(), {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      });

      if (!res.ok) break;
      const data = await res.json();
      const items = data.items || [];

      for (const item of items) {
        const cafeurl = (item.cafeurl || "").toLowerCase();
        if (!cafeurl.includes(cafeId.toLowerCase())) continue;

        // Extract articleId from link
        const linkMatch = (item.link || "").match(/\/(\d+)(?:\?|$)/);
        if (!linkMatch) continue;

        articles.push({
          articleId: parseInt(linkMatch[1], 10),
          subject: stripHtml(item.title || ""),
        });

        if (articles.length >= maxArticles) break;
      }

      if (articles.length >= maxArticles) break;
      if (items.length < pageSize) break;

      await sleep(300);
    } catch {
      break;
    }
  }

  return articles;
}

/* ------------------------------------------------------------------ */
/* Step 3: Fetch comments for a single article                        */
/* ------------------------------------------------------------------ */

interface CafeComment {
  commentId: string;
  commentText: string;
  commentAuthor: string;
  commentDate: string;
}

async function fetchArticleComments(
  clubId: string,
  articleId: number
): Promise<CafeComment[]> {
  const comments: CafeComment[] = [];

  for (let page = 1; page <= 20; page++) {
    try {
      const url = `https://apis.naver.com/cafe-web/cafe-articleapi/v2/cafes/${clubId}/articles/${articleId}/comments/pages/${page}?requestFrom=A&orderBy=asc`;
      const res = await fetch(url, {
        headers: {
          Referer: `https://cafe.naver.com/`,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
      });

      if (!res.ok) break;
      const data = await res.json();

      const commentList =
        data?.result?.comments ??
        data?.comments ??
        data?.result?.commentList ??
        [];

      if (!Array.isArray(commentList) || commentList.length === 0) break;

      for (const c of commentList) {
        comments.push({
          commentId: String(c.commentId ?? c.id ?? ""),
          commentText: stripHtml(c.content ?? c.body ?? c.text ?? ""),
          commentAuthor: c.writer?.nick ?? c.writerNickName ?? c.author ?? "",
          commentDate: c.updateDate ?? c.writeDate ?? c.createdAt ?? "",
        });
      }

      // Check if there are more pages
      const hasNext =
        data?.result?.hasNext ?? data?.result?.nextPage != null ?? false;
      if (!hasNext) break;
    } catch {
      break;
    }
  }

  return comments;
}

/* ------------------------------------------------------------------ */
/* POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: Request) {
  let body: { cafeId?: string; keyword?: string; maxArticles?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "올바른 JSON 본문이 필요합니다." },
      { status: 400 }
    );
  }

  const { cafeId, keyword, maxArticles = 500 } = body;

  if (!cafeId || !keyword) {
    return NextResponse.json(
      { error: "cafeId와 keyword는 필수입니다." },
      { status: 400 }
    );
  }

  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  try {
    // 1. Resolve clubId
    const clubId = await resolveClubId(cafeId);

    let articles: ArticleInfo[] = [];
    let cafeName = cafeId;
    let method: "internal" | "search" = "internal";

    if (clubId) {
      // 2a. Fetch articles via internal API
      articles = await fetchArticleList(clubId, maxArticles);
    }

    if (articles.length === 0) {
      // 2b. Fallback to Naver search API
      method = "search";
      if (!clientId || !clientSecret) {
        return NextResponse.json(
          {
            error:
              "카페 내부 API 접근이 차단되었고, NAVER_CLIENT_ID/SECRET이 설정되지 않아 검색 폴백도 불가합니다.",
          },
          { status: 500 }
        );
      }
      articles = await fetchArticleListViaSearch(
        cafeId,
        clientId,
        clientSecret,
        maxArticles
      );
    }

    if (articles.length === 0) {
      return NextResponse.json({
        cafeId,
        cafeName,
        keyword,
        scannedArticles: 0,
        scannedComments: 0,
        method,
        items: [],
        error: "게시글 목록을 가져올 수 없습니다. 카페 ID를 확인해주세요.",
      });
    }

    // 3. Fetch comments for each article and filter by keyword
    const kwLower = keyword.toLowerCase();
    const matchedItems: Array<{
      commentId: string;
      commentText: string;
      commentAuthor: string;
      commentDate: string;
      articleId: string;
      articleTitle: string;
      articleLink: string;
    }> = [];

    let scannedComments = 0;
    let scannedArticles = 0;

    for (const article of articles) {
      scannedArticles++;

      if (!clubId) {
        // Without clubId we can't fetch comments from internal API
        continue;
      }

      try {
        const comments = await fetchArticleComments(
          clubId,
          article.articleId
        );
        scannedComments += comments.length;

        for (const c of comments) {
          if (c.commentText.toLowerCase().includes(kwLower)) {
            matchedItems.push({
              commentId: c.commentId,
              commentText: c.commentText,
              commentAuthor: c.commentAuthor,
              commentDate: c.commentDate,
              articleId: String(article.articleId),
              articleTitle: article.subject,
              articleLink: `https://cafe.naver.com/${cafeId}/${article.articleId}`,
            });
          }
        }
      } catch {
        // Skip failed article
      }

      // Rate limit: 300ms delay between articles
      if (scannedArticles < articles.length) {
        await sleep(300);
      }
    }

    return NextResponse.json({
      cafeId,
      cafeName,
      keyword,
      scannedArticles,
      scannedComments,
      method,
      items: matchedItems,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `카페 댓글 검색 실패: ${message}` },
      { status: 500 }
    );
  }
}
