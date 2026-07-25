"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, LayoutDashboard, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/bookmarks", label: "ブックマーク", icon: Bookmark },
  { href: "/trends", label: "トレンド分析", icon: TrendingUp },
];

export function NavLinks({
  className,
  itemClassName,
  onNavigate,
}: {
  className?: string;
  itemClassName?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive ? "text-primary" : "text-muted-foreground",
              itemClassName
            )}
          >
            <Icon className="size-4" />
            {label}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-3 -bottom-px h-px scale-x-0 bg-primary transition-transform duration-300 ease-out group-hover:scale-x-100",
                isActive && "scale-x-100"
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
