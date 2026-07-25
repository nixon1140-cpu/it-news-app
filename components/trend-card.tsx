import { Lightbulb } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface TrendItem {
  trend_title: string;
  description: string;
  action_advice: string;
}

export function TrendCard({
  trend,
  index,
}: {
  trend: TrendItem;
  index: number;
}) {
  return (
    <Card
      className={cn(
        "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg",
        index === 0 && "ring-primary/40"
      )}
    >
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="font-heading flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {index + 1}
          </span>
          <CardTitle className="font-heading pt-1 text-lg leading-snug font-semibold">
            {trend.trend_title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {trend.description}
        </p>
        <div className="flex items-start gap-2 rounded-md bg-accent p-3">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="flex flex-col gap-1">
            <p className="eyebrow text-accent-foreground/70">行動アドバイス</p>
            <p className="text-sm text-accent-foreground">{trend.action_advice}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
