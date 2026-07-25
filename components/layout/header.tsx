"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Newspaper } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { NavLinks } from "@/components/layout/nav-links";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Newspaper className="size-6 text-primary" />
            <span className="hidden font-heading text-xl leading-none font-semibold tracking-tight sm:inline">
              IT News Navigator
            </span>
          </Link>
          <NavLinks className="hidden md:flex" />
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ModeToggle />
          <ThemeToggle />
        </div>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="md:hidden" />}
          >
            <Menu className="size-5" />
            <span className="sr-only">メニューを開く</span>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>メニュー</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-4 p-4">
              <NavLinks
                className="flex-col items-stretch gap-1"
                itemClassName="w-full"
                onNavigate={() => setMenuOpen(false)}
              />
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <ModeToggle className="w-full" />
                <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-sm font-medium">表示テーマ</span>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
