"use client";

import { useEffect, useMemo, useState } from "react";
import type { TrendCategory } from "@/types/trend";

export const TREND_SETTINGS_STORAGE_KEY = "trendradar.settings.v1";

export const REGION_OPTIONS = ["全部", "台灣", "全球", "日本", "美國"] as const;
export const REFRESH_INTERVAL_OPTIONS = [
  { label: "手動", value: 0 },
  { label: "每 10 分鐘", value: 10 },
  { label: "每 30 分鐘", value: 30 },
  { label: "每小時", value: 60 },
] as const;

export type TrendRegion = (typeof REGION_OPTIONS)[number];

export type TrendSettings = {
  region: TrendRegion;
  enabledCategories: TrendCategory[];
  refreshIntervalMinutes: number;
  minScore: number;
  limit: number;
  useMockFallback: boolean;
};

export const DEFAULT_ENABLED_CATEGORIES: TrendCategory[] = [
  "國際",
  "台海",
  "新聞",
  "社會",
  "政治",
  "生活",
  "體育",
  "科技",
  "3C",
  "遊戲",
  "旅遊",
  "動漫",
  "文化",
  "娛樂",
  "財經",
  "AI",
];

export const DEFAULT_TREND_SETTINGS: TrendSettings = {
  region: "全部",
  enabledCategories: DEFAULT_ENABLED_CATEGORIES,
  refreshIntervalMinutes: 0,
  minScore: 0,
  limit: 30,
  useMockFallback: true,
};

function normalizeSettings(value: unknown): TrendSettings {
  if (!value || typeof value !== "object") return DEFAULT_TREND_SETTINGS;
  const raw = value as Partial<TrendSettings>;
  const enabledCategories = Array.isArray(raw.enabledCategories)
    ? DEFAULT_ENABLED_CATEGORIES.filter((category) => raw.enabledCategories?.includes(category))
    : DEFAULT_ENABLED_CATEGORIES;

  return {
    region: REGION_OPTIONS.includes(raw.region as TrendRegion) ? (raw.region as TrendRegion) : "全部",
    enabledCategories: enabledCategories.length ? enabledCategories : DEFAULT_ENABLED_CATEGORIES,
    refreshIntervalMinutes:
      typeof raw.refreshIntervalMinutes === "number" && [0, 10, 30, 60].includes(raw.refreshIntervalMinutes)
        ? raw.refreshIntervalMinutes
        : 0,
    minScore: typeof raw.minScore === "number" ? Math.min(100, Math.max(0, raw.minScore)) : 0,
    limit: typeof raw.limit === "number" ? Math.min(60, Math.max(5, raw.limit)) : 30,
    useMockFallback: typeof raw.useMockFallback === "boolean" ? raw.useMockFallback : true,
  };
}

export function readTrendSettings(): TrendSettings {
  if (typeof window === "undefined") return DEFAULT_TREND_SETTINGS;
  const raw = window.localStorage.getItem(TREND_SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_TREND_SETTINGS;

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_TREND_SETTINGS;
  }
}

export function saveTrendSettings(settings: TrendSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TREND_SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
  window.dispatchEvent(new CustomEvent("trendradar-settings-updated", { detail: settings }));
}

export function useTrendSettings() {
  const [settings, setSettingsState] = useState<TrendSettings>(DEFAULT_TREND_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettingsState(readTrendSettings());
    setReady(true);

    function handleStorage(event: StorageEvent) {
      if (event.key === TREND_SETTINGS_STORAGE_KEY) setSettingsState(readTrendSettings());
    }

    function handleCustomUpdate() {
      setSettingsState(readTrendSettings());
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("trendradar-settings-updated", handleCustomUpdate as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("trendradar-settings-updated", handleCustomUpdate as EventListener);
    };
  }, []);

  const setSettings = useMemo(
    () =>
      (next: TrendSettings | ((current: TrendSettings) => TrendSettings)) => {
        setSettingsState((current) => {
          const updated = normalizeSettings(typeof next === "function" ? next(current) : next);
          saveTrendSettings(updated);
          return updated;
        });
      },
    [],
  );

  const resetSettings = useMemo(
    () => () => {
      saveTrendSettings(DEFAULT_TREND_SETTINGS);
      setSettingsState(DEFAULT_TREND_SETTINGS);
    },
    [],
  );

  return { settings, setSettings, resetSettings, ready };
}
