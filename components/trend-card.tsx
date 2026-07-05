import { Lightbulb } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card className={index === 0 ? "ring-primary/40" : undefined}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {index + 1}
          </span>
          <CardTitle className="leading-snug">{trend.trend_title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{trend.description}</p>
        <div className="flex items-start gap-2 rounded-md bg-accent p-3">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-accent-foreground">
              行動アドバイス
            </p>
            <p className="text-sm text-accent-foreground">{trend.action_advice}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
