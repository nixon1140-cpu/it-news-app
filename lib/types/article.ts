export type PriorityLabel = "High" | "Mid" | "Low";

export interface Article {
  id: string;
  title: string;
  url: string;
  summary: string;
  trend_diff: string;
  action_individual: string;
  action_enterprise: string;
  category: string;
  priority_label: PriorityLabel;
  importance: number;
  published_at: string;
}
