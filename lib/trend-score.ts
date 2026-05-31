import type { TrendTopic } from "@/types/trend";

export function calculateTrendScore(metrics: TrendTopic["metrics"]): number {
  const score =
    metrics.searchScore * 0.3 +
    metrics.newsScore * 0.2 +
    metrics.socialScore * 0.2 +
    metrics.engagementScore * 0.15 +
    metrics.velocityScore * 0.1 +
    metrics.diversityScore * 0.05;

  return Math.round(score);
}

export function scoreBadgeClass(score: number): string {
  if (score >= 90) return "bg-red-100 text-red-700";
  if (score >= 80) return "bg-orange-100 text-orange-700";
  return "bg-blue-100 text-blue-700";
}
