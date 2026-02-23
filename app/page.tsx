"use client";

import { useState, useCallback } from "react";
import { UnifiedScan } from "@/components/unified-scan";
import { YouTubeTab } from "@/components/youtube-tab";
import { YouTubeTitleTab } from "@/components/youtube-title-tab";
import { NaverTab } from "@/components/naver-tab";
import { CafeTab } from "@/components/cafe-tab";
import { GoogleTab } from "@/components/google-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Youtube, Coffee, Search } from "lucide-react";
import type { MonitoringItem } from "@/lib/types";

export default function Page() {
  const [totalItems, setTotalItems] = useState(0);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});

  const updateTabCount = useCallback((tab: string, count: number) => {
    setTabCounts((prev) => ({ ...prev, [tab]: count }));
  }, []);

  const handleItemsCollected = useCallback((items: MonitoringItem[], tab: string) => {
    updateTabCount(tab, items.length);
    setTotalItems((prev) => prev + items.length);
  }, [updateTabCount]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation (sticky) */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-sm font-bold text-primary-foreground">F</span>
            </div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Fitchnic Monitoring Tower
            </h1>
          </div>
          <div className="flex items-center gap-3">
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
        <Tabs defaultValue="home" className="flex flex-col gap-6">
          <TabsList className="self-start bg-card border border-border h-auto p-1 overflow-x-auto max-w-full">
            <TabsTrigger
              value="home"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              통합 검색
              {(tabCounts["home"] ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">
                  {tabCounts["home"]}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="blog"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
            >
              <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#03C75A] text-[8px] font-bold text-white">
                N
              </span>
              블로그
              {(tabCounts["blog"] ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">
                  {tabCounts["blog"]}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="cafe"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
            >
              <Coffee className="h-3.5 w-3.5" />
              카페
              {(tabCounts["cafe"] ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">
                  {tabCounts["cafe"]}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="google"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" fill="#34A853" />
                <path d="M5.84 14.1a6.93 6.93 0 0 1 0-4.19V7.07H2.18A11.97 11.97 0 0 0 1 12c0 1.78.4 3.48 1.18 5.02l3.66-2.93Z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" fill="#EA4335" />
              </svg>
              구글/웹
              {(tabCounts["google"] ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">
                  {tabCounts["google"]}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="youtube-title"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
            >
              <div className="flex items-center gap-0.5">
                <Youtube className="h-3.5 w-3.5" />
                <Search className="h-2.5 w-2.5" />
              </div>
              유튜브(제목)
              {(tabCounts["youtube-title"] ?? 0) > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">
                  {tabCounts["youtube-title"]}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="youtube-comments"
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2"
            >
              <Youtube className="h-3.5 w-3.5" />
              유튜브(댓글)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="home" forceMount className="mt-0 data-[state=inactive]:hidden">
            <UnifiedScan
              onItemsCollected={(items) => handleItemsCollected(items, "home")}
            />
          </TabsContent>

          <TabsContent value="blog" forceMount className="mt-0 data-[state=inactive]:hidden">
            <NaverTab
              onItemsCollected={(items) => handleItemsCollected(items, "blog")}
            />
          </TabsContent>

          <TabsContent value="cafe" forceMount className="mt-0 data-[state=inactive]:hidden">
            <CafeTab
              onItemsCollected={(items) => handleItemsCollected(items, "cafe")}
            />
          </TabsContent>

          <TabsContent value="google" forceMount className="mt-0 data-[state=inactive]:hidden">
            <GoogleTab
              onItemsCollected={(items) => handleItemsCollected(items, "google")}
            />
          </TabsContent>

          <TabsContent value="youtube-title" forceMount className="mt-0 data-[state=inactive]:hidden">
            <YouTubeTitleTab
              onItemsCollected={(items) => handleItemsCollected(items, "youtube-title")}
            />
          </TabsContent>

          <TabsContent value="youtube-comments" forceMount className="mt-0 data-[state=inactive]:hidden">
            <YouTubeTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
