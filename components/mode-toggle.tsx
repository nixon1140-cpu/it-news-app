"use client";

import { useEffect, useState } from "react";
import { Briefcase, Code2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { useModeStore } from "@/lib/store/mode-store";
import { cn } from "@/lib/utils";

export function ModeToggle({ className }: { className?: string }) {
  const [hydrated, setHydrated] = useState(false);
  const mode = useModeStore((state) => state.mode);
  const toggleMode = useModeStore((state) => state.toggleMode);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const isEnterprise = hydrated && mode === "enterprise";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-full border border-border bg-card px-3.5 py-2 transition-colors",
        className
      )}
    >
      <Code2
        className={cn(
          "size-4 transition-colors",
          !isEnterprise ? "text-primary" : "text-muted-foreground"
        )}
      />
      <Switch
        checked={isEnterprise}
        onCheckedChange={toggleMode}
        aria-label="エンジニア視点とビジネス視点を切り替え"
      />
      <Briefcase
        className={cn(
          "size-4 transition-colors",
          isEnterprise ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span className="text-sm font-medium">
        {isEnterprise ? "ビジネス視点" : "エンジニア視点"}
      </span>
    </div>
  );
}
