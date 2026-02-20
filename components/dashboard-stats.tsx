"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Activity } from "lucide-react";
import type { MonitoringItem } from "@/lib/types";

interface DashboardStatsProps {
  items: MonitoringItem[];
}

export function DashboardStats({ items }: DashboardStatsProps) {
  // Calculate statistics
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayItems = items.filter(item => {
    const itemDate = new Date(item.publishedAt);
    return itemDate >= today;
  });

  const flaggedItems = items.filter(item => item.isFlagged);
  
  const sourceBreakdown = items.reduce((acc, item) => {
    acc[item.source] = (acc[item.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Mock trend calculation (positive trend for demo)
  const trend = todayItems.length > 0 ? "+12%" : "0%";
  const trendPositive = todayItems.length > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* 오늘의 총 언급량 */}
      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                오늘의 총 언급량
              </p>
              <p className="text-3xl font-bold text-foreground">
                {todayItems.length}
              </p>
              <div className="flex items-center gap-1 mt-2">
                {trendPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                )}
                <span className={`text-xs font-medium ${trendPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {trend}
                </span>
                <span className="text-xs text-muted-foreground">vs 어제</span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 위험 징후 */}
      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                위험 징후
              </p>
              <p className="text-3xl font-bold text-foreground">
                {flaggedItems.length}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <Badge 
                  variant={flaggedItems.length > 0 ? "destructive" : "secondary"}
                  className="text-xs h-5"
                >
                  {flaggedItems.length > 0 ? "주의 필요" : "정상"}
                </Badge>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 네이버 언급 */}
      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                네이버 언급
              </p>
              <p className="text-3xl font-bold text-foreground">
                {sourceBreakdown.naver || 0}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-xs text-muted-foreground">
                  블로그 + 카페
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#03C75A]/10">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-[#03C75A] text-[9px] font-bold text-white">
                N
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 구글/웹 언급 */}
      <Card className="border border-border bg-card shadow-sm">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                구글/웹 언급
              </p>
              <p className="text-3xl font-bold text-foreground">
                {sourceBreakdown.google || 0}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-xs text-muted-foreground">
                  검색 결과
                </span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
