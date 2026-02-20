/**
 * Parse YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 */
export function parseVideoId(url: string): string | null {
  if (!url) return null;

  // If it's just a raw video ID (11 chars alphanumeric + _-)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) {
    return url.trim();
  }

  try {
    const parsed = new URL(url.trim());
    const hostname = parsed.hostname.replace("www.", "");

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      // /watch?v=ID
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      // /shorts/ID, /embed/ID, /v/ID
      const pathMatch = parsed.pathname.match(
        /^\/(shorts|embed|v)\/([a-zA-Z0-9_-]{11})/
      );
      if (pathMatch) return pathMatch[2];
    }

    if (hostname === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

interface YouTubeApiComment {
  id: string;
  snippet: {
    videoId?: string;
    textOriginal: string;
    textDisplay: string;
    authorDisplayName: string;
    authorChannelId?: { value: string };
    authorChannelUrl?: string;
    likeCount: number;
    publishedAt: string;
    updatedAt: string;
    parentId?: string;
  };
}

interface CommentThread {
  id: string;
  snippet: {
    videoId: string;
    topLevelComment: YouTubeApiComment;
    totalReplyCount: number;
  };
  replies?: {
    comments: YouTubeApiComment[];
  };
}

interface CommentThreadsResponse {
  nextPageToken?: string;
  pageInfo: { totalResults: number };
  items: CommentThread[];
}

interface CommentsListResponse {
  nextPageToken?: string;
  items: YouTubeApiComment[];
}

import type { CommentRecord } from "./types";

export interface VideoDetails {
  title: string;
  description: string;
  channel: string;
  channelId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  publishedAt: string;
  thumbnail: string;
}

/**
 * Fetch video title from YouTube Data API v3
 */
export async function fetchVideoTitle(
  videoId: string,
  apiKey: string
): Promise<string> {
  try {
    const details = await fetchVideoDetails(videoId, apiKey);
    return details?.title ?? "";
  } catch {
    return "";
  }
}

/**
 * Fetch full video details from YouTube Data API v3
 */
export async function fetchVideoDetails(
  videoId: string,
  apiKey: string
): Promise<VideoDetails | null> {
  try {
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,statistics");
    url.searchParams.set("id", videoId);
    url.searchParams.set("key", apiKey);

    const res = await fetchWithRetry(url.toString());
    const data = await res.json();

    if (!data.items || data.items.length === 0) return null;

    const item = data.items[0];
    const snippet = item.snippet;
    const stats = item.statistics;

    return {
      title: snippet.title ?? "",
      description: snippet.description ?? "",
      channel: snippet.channelTitle ?? "",
      channelId: snippet.channelId ?? "",
      viewCount: parseInt(stats?.viewCount ?? "0", 10),
      likeCount: parseInt(stats?.likeCount ?? "0", 10),
      commentCount: parseInt(stats?.commentCount ?? "0", 10),
      tags: snippet.tags ?? [],
      publishedAt: snippet.publishedAt ?? "",
      thumbnail:
        snippet.thumbnails?.maxres?.url ??
        snippet.thumbnails?.high?.url ??
        snippet.thumbnails?.medium?.url ??
        "",
    };
  } catch {
    return null;
  }
}

function mapComment(
  c: YouTubeApiComment,
  videoId: string,
  videoUrl: string,
  threadId: string,
  parentId: string | null
): CommentRecord {
  return {
    video_id: videoId,
    video_url: videoUrl,
    comment_id: c.id,
    thread_id: threadId,
    parent_id: parentId,
    is_reply: parentId !== null,
    author_display_name: c.snippet.authorDisplayName,
    author_channel_id: c.snippet.authorChannelId?.value ?? "",
    author_profile_url: c.snippet.authorChannelUrl ?? "",
    text_original: c.snippet.textOriginal,
    text_plain: stripHtml(c.snippet.textDisplay),
    like_count: c.snippet.likeCount,
    published_at: c.snippet.publishedAt,
    updated_at: c.snippet.updatedAt,
    fetched_at: new Date().toISOString(),
    source: "youtube_api",
  };
}

async function fetchWithRetry(
  url: string,
  retries = 3,
  delay = 1000
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url);
    if (res.ok) return res;

    if (res.status === 403) {
      const body = await res.json().catch(() => null);
      const reason = body?.error?.errors?.[0]?.reason;
      if (reason === "commentsDisabled") {
        throw new Error("COMMENTS_DISABLED");
      }
      if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
        throw new Error("QUOTA_EXCEEDED");
      }
      throw new Error(`API_FORBIDDEN: ${reason || res.statusText}`);
    }

    if (res.status === 404) {
      throw new Error("VIDEO_NOT_FOUND");
    }

    // Retry on 429 or 5xx
    if ((res.status === 429 || res.status >= 500) && i < retries) {
      await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
      continue;
    }

    const errBody = await res.text().catch(() => "");
    throw new Error(`API_ERROR: ${res.status} ${errBody}`);
  }
  throw new Error("MAX_RETRIES_EXCEEDED");
}

export interface CollectOptions {
  videoId: string;
  videoUrl: string;
  apiKey: string;
  order: "time" | "relevance";
  maxPages: number; // 0 = unlimited
  includeReplies: boolean;
  onProgress: (pages: number, comments: number) => void;
}

export async function collectComments(
  opts: CollectOptions
): Promise<CommentRecord[]> {
  const { videoId, videoUrl, apiKey, order, maxPages, includeReplies, onProgress } = opts;
  const comments: Map<string, CommentRecord> = new Map();
  let pageToken: string | undefined;
  let pageCount = 0;

  // Phase 1: Fetch comment threads
  while (true) {
    const url = new URL("https://www.googleapis.com/youtube/v3/commentThreads");
    url.searchParams.set("part", "snippet,replies");
    url.searchParams.set("videoId", videoId);
    url.searchParams.set("maxResults", "100");
    url.searchParams.set("order", order);
    url.searchParams.set("textFormat", "plainText");
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetchWithRetry(url.toString());
    const data: CommentThreadsResponse = await res.json();

    for (const thread of data.items) {
      const topComment = thread.snippet.topLevelComment;
      const threadId = thread.id;

      // Add top-level comment
      const topRecord = mapComment(topComment, videoId, videoUrl, threadId, null);
      comments.set(topRecord.comment_id, topRecord);

      // Add inline replies
      if (includeReplies && thread.replies?.comments) {
        for (const reply of thread.replies.comments) {
          const replyRecord = mapComment(reply, videoId, videoUrl, threadId, topComment.id);
          comments.set(replyRecord.comment_id, replyRecord);
        }

        // If there are significantly more replies than what's inline, fetch them separately
        const inlineCount = thread.replies.comments.length || 0;
        const totalReplies = thread.snippet.totalReplyCount;
        if (totalReplies > inlineCount && totalReplies - inlineCount > 5) {
          let replyPageToken: string | undefined;
          while (true) {
            const replyUrl = new URL("https://www.googleapis.com/youtube/v3/comments");
            replyUrl.searchParams.set("part", "snippet");
            replyUrl.searchParams.set("parentId", topComment.id);
            replyUrl.searchParams.set("maxResults", "100");
            replyUrl.searchParams.set("textFormat", "plainText");
            replyUrl.searchParams.set("key", apiKey);
            if (replyPageToken) replyUrl.searchParams.set("pageToken", replyPageToken);

            const replyRes = await fetchWithRetry(replyUrl.toString());
            const replyData: CommentsListResponse = await replyRes.json();

            for (const reply of replyData.items) {
              const replyRecord = mapComment(reply, videoId, videoUrl, threadId, topComment.id);
              comments.set(replyRecord.comment_id, replyRecord);
            }

            if (!replyData.nextPageToken) break;
            replyPageToken = replyData.nextPageToken;
          }
        }
      }
    }

    pageCount++;
    onProgress(pageCount, comments.size);

    if (!data.nextPageToken) break;
    if (maxPages > 0 && pageCount >= maxPages) break;

    pageToken = data.nextPageToken;
  }

  return Array.from(comments.values());
}
