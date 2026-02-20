export interface CommentRecord {
  video_id: string;
  video_url: string;
  comment_id: string;
  thread_id: string;
  parent_id: string | null;
  is_reply: boolean;
  author_display_name: string;
  author_channel_id: string;
  author_profile_url: string;
  text_original: string;
  text_plain: string;
  like_count: number;
  published_at: string;
  updated_at: string;
  fetched_at: string;
  source: "youtube_api";
}

export type JobStatus = "queued" | "running" | "done" | "error";

export interface JobProgress {
  pages: number;
  comments: number;
  currentPage: string;
}

export interface Job {
  id: string;
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  order: "time" | "relevance";
  maxPages: number;
  includeReplies: boolean;
  status: JobStatus;
  progress: JobProgress;
  error?: string;
  createdAt: string;
  comments: CommentRecord[];
}

export const DEFAULT_NEGATIVE_KEYWORDS = [
  "사기",
  "별로",
  "비추",
  "쓰레기",
  "거짓",
  "환불",
  "최악",
  "짜증",
  "속았다",
  "후회",
  "광고",
  "돈 낭비",
  "실망",
  "개쓰레기",
  "폭로",
];

/** Platform source types for unified monitoring */
export type PlatformSource = "youtube" | "naver" | "google";

/** Sub-type within each platform */
export type MonitoringType =
  | "comment"
  | "blog"
  | "cafe"
  | "web"
  | "news"
  | "general";

/** Unified monitoring item that all platforms map to */
export interface MonitoringItem {
  id: string;
  source: PlatformSource;
  type: MonitoringType;
  title: string;
  content: string;
  author: string;
  authorUrl?: string;
  link: string;
  publishedAt: string;
  matchedKeywords: string[];
  isFlagged: boolean;
}

/** Brand keyword for monitoring */
export interface BrandKeyword {
  id: string;
  keyword: string;
  createdAt: string;
}

export const DEFAULT_BRAND_KEYWORDS = ["핏크닉", "윙즈", "셀팜"];
