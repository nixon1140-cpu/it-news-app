"use client";

import { useEffect, useState } from "react";

import { TrendCard, type TrendItem } from "@/components/trend-card";
import { TrendGridSkeleton } from "@/components/trend-grid-skeleton";

export default function TrendsPage() {
  const [trends, setTrends] = useState<TrendItem[] | null>(null);
  const [cached, setCached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/trends")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        setTrends(data.trends ?? []);
        setCached(Boolean(data.cached));
      })
      .catch((err) => {
        if (active) setError((err as Error).message);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">AIによるマクロ分析</p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          トレンド分析
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          直近のニュースからAIが抽出した、IT業界のマクロなトレンドです。
          {cached && "（キャッシュ済みのデータを表示しています。最大12時間ごとに更新されます）"}
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          トレンドの取得に失敗しました: {error}
        </p>
      )}

      {!error && trends === null && <TrendGridSkeleton />}

      {!error && trends !== null && trends.length === 0 && (
        <p className="text-sm text-muted-foreground">
          分析に十分なニュースデータがまだありません。クローラーを実行して記事を増やしてください。
        </p>
      )}

      {!error && trends !== null && trends.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {trends.map((trend, index) => (
            <div
              key={index}
              className="fade-up-in"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <TrendCard trend={trend} index={index} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
