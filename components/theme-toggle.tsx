"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  /** "icon": サイドバー等に置くアイコンのみのボタン。"nav": ボトムナビ用のアイコン+ラベル表示。 */
  variant?: "icon" | "nav";
}

export function ThemeToggle({ className, variant = "icon" }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  if (variant === "nav") {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="テーマ切り替え"
        className={cn(
          "flex flex-col items-center gap-1 text-muted-foreground",
          className
        )}
      >
        {isDark ? <Moon className="size-5" /> : <Sun className="size-5" />}
        <span className="text-[11px] font-medium">テーマ</span>
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="テーマ切り替え"
            className={className}
          />
        }
      >
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        <span className="sr-only">テーマ切り替え</span>
      </TooltipTrigger>
      <TooltipContent>テーマ切り替え</TooltipContent>
    </Tooltip>
  );
}
