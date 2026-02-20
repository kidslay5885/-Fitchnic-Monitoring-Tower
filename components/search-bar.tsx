"use client";

import React from "react"

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, History } from "lucide-react";

const SEARCH_HISTORY_KEY = "fitcnic_search_history";
const MAX_HISTORY = 10;

interface SearchBarProps {
  onSearch: (keyword: string) => void;
  placeholder?: string;
}

export function SearchBar({ onSearch, placeholder = "키워드 검색..." }: SearchBarProps) {
  const [input, setInput] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // localStorage에서 검색 기록 로드
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSearchHistory(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const saveToHistory = (keyword: string) => {
    if (!mounted) return;
    
    setSearchHistory((prev) => {
      const filtered = prev.filter((k) => k !== keyword);
      const updated = [keyword, ...filtered].slice(0, MAX_HISTORY);
      
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    
    onSearch(trimmed);
    saveToHistory(trimmed);
    setInput("");
  };

  const handleHistoryClick = (keyword: string) => {
    onSearch(keyword);
    saveToHistory(keyword);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 검색창 */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="h-12 pl-10 pr-4 text-base border-2 border-border focus-visible:border-primary focus-visible:ring-0 bg-card shadow-sm"
          />
        </div>
        <Button 
          type="submit" 
          size="lg"
          className="h-12 px-6 shadow-sm"
          disabled={!input.trim()}
        >
          <Search className="h-4 w-4 mr-2" />
          검색
        </Button>
      </form>

      {/* 최근 검색 기록 */}
      {searchHistory.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">최근 검색:</span>
          </div>
          {searchHistory.map((keyword) => (
            <Badge
              key={keyword}
              variant="outline"
              className="text-xs cursor-pointer hover:bg-accent transition-colors"
              onClick={() => handleHistoryClick(keyword)}
            >
              {keyword}
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistory}
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            지우기
          </Button>
        </div>
      )}
    </div>
  );
}
