import type { HeatLifecycle } from "@/lib/discovery/heat-lifecycle";
import { normalizeSignalFamily } from "@/lib/signals/model-replay";

export type PreviousLifecycleSnapshot = {
  continuityKey: string;
  signalEventId: string | null;
  asOfDate: string;
  lastSeenAsOf: string;
  lifecycleState: HeatLifecycle;
};

export type CurrentLifecycleSignal = {
  signalEventId: string;
  topic: string;
  asOfDate: string;
  lifecycleState: HeatLifecycle;
  lifecycleReason: string;
};

export type LifecycleTransition = {
  continuityKey: string;
  signalEventId: string | null;
  asOfDate: string;
  lastSeenAsOf: string;
  lifecycleState: HeatLifecycle;
  previousState: HeatLifecycle | null;
  transitionReason: string;
};

const DAY_MS = 86_400_000;

export function signalContinuityKey(topic: string) {
  const withoutMonth = topic.replace(/^\d{4}-\d{2}\s+/, "").trim();
  const family = normalizeSignalFamily(withoutMonth);
  if (family !== "other") return family;
  return withoutMonth
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function elapsedDays(from: string, to: string) {
  return Math.floor(
    (new Date(`${to}T00:00:00.000Z`).getTime() - new Date(`${from}T00:00:00.000Z`).getTime()) / DAY_MS,
  );
}

export function buildLifecycleTransitions(
  currentSignals: CurrentLifecycleSignal[],
  previousSnapshots: PreviousLifecycleSnapshot[],
  asOfDate: string,
) {
  const previousByKey = new Map(previousSnapshots.map((item) => [item.continuityKey, item]));
  const currentKeys = new Set<string>();
  const transitions: LifecycleTransition[] = [];

  for (const signal of currentSignals) {
    const continuityKey = signalContinuityKey(signal.topic);
    currentKeys.add(continuityKey);
    const previous = previousByKey.get(continuityKey);
    const lifecycleState =
      previous?.lifecycleState === "expired" ? "reactivated" : signal.lifecycleState;
    transitions.push({
      continuityKey,
      signalEventId: signal.signalEventId,
      asOfDate,
      lastSeenAsOf: asOfDate,
      lifecycleState,
      previousState: previous?.lifecycleState ?? null,
      transitionReason: previous?.lifecycleState === "expired"
        ? `主題自 ${previous.lastSeenAsOf} 後曾失效，本月重新出現。`
        : signal.lifecycleReason,
    });
  }

  for (const previous of previousSnapshots) {
    if (currentKeys.has(previous.continuityKey)) continue;
    const dormantDays = elapsedDays(previous.lastSeenAsOf, asOfDate);
    const lifecycleState: HeatLifecycle = dormantDays > 45 ? "expired" : "cooling";
    transitions.push({
      continuityKey: previous.continuityKey,
      signalEventId: null,
      asOfDate,
      lastSeenAsOf: previous.lastSeenAsOf,
      lifecycleState,
      previousState: previous.lifecycleState,
      transitionReason: lifecycleState === "expired"
        ? `連續 ${dormantDays} 天未再進入月度候選，標記為已失效。`
        : `本月未再進入候選，距離最後出現 ${dormantDays} 天，先標記為降溫。`,
    });
  }

  return transitions;
}
