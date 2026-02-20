"use client";

import React from "react"

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Youtube, Play, Settings2 } from "lucide-react";

interface CollectFormProps {
  onSubmit: (data: {
    url: string;
    order: "time" | "relevance";
    maxPages: number;
    includeReplies: boolean;
  }) => void;
  isLoading: boolean;
}

export function CollectForm({ onSubmit, isLoading }: CollectFormProps) {
  const [url, setUrl] = useState("");
  const [order, setOrder] = useState<"time" | "relevance">("relevance");
  const [maxPages, setMaxPages] = useState("0");
  const [includeReplies, setIncludeReplies] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onSubmit({
      url: url.trim(),
      order,
      maxPages: parseInt(maxPages, 10) || 0,
      includeReplies,
    });
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg text-card-foreground">
          <Youtube className="h-5 w-5 text-destructive" />
          영상 URL 입력
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Input
              placeholder="https://www.youtube.com/watch?v=... 또는 youtu.be/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1 border-input bg-secondary text-secondary-foreground placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !url.trim()}>
              <Play className="mr-2 h-4 w-4" />
              {isLoading ? "수집 중..." : "댓글 수집 시작"}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {showOptions ? "옵션 숨기기" : "고급 옵션"}
          </button>

          {showOptions && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">
                  정렬 기준
                </Label>
                <Select
                  value={order}
                  onValueChange={(v) => setOrder(v as "time" | "relevance")}
                  disabled={isLoading}
                >
                  <SelectTrigger className="bg-secondary text-secondary-foreground border-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time">최신순 (time)</SelectItem>
                    <SelectItem value="relevance">
                      관련성순 (relevance)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">
                  최대 페이지 수 (0=무제한, 1페이지=100개)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  className="bg-secondary text-secondary-foreground border-input"
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-end gap-3 pb-1">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={includeReplies}
                    onCheckedChange={setIncludeReplies}
                    disabled={isLoading}
                  />
                  <Label className="text-sm text-muted-foreground">
                    대댓글 포함
                  </Label>
                </div>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
