export type StreakDirection = "up" | "down" | "flat";

export type StreakResult = {
  direction: StreakDirection;
  days: number;
  status: "ready" | "insufficient_data";
};

/**
 * Counts how many consecutive entries at the front of `directionsDescending`
 * (latest first) share the same direction. Callers adapt their own domain
 * data (price closes, institutional net-flow sign, ...) into a direction
 * series; this function has no knowledge of prices, dates, or Supabase.
 */
export function computeStreak(directionsDescending: StreakDirection[]): StreakResult {
  const latest = directionsDescending[0];
  if (!latest) {
    return { direction: "flat", days: 0, status: "insufficient_data" };
  }

  let days = 0;
  for (const direction of directionsDescending) {
    if (direction !== latest) break;
    days += 1;
  }

  return { direction: latest, days, status: "ready" };
}
