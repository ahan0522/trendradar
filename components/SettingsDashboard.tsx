"use client";

import React from "react";
import { Bell, CheckCircle2, RotateCcw, Save, Settings2, SlidersHorizontal } from "lucide-react";
import { categories } from "@/data/mock-topics";
import {
  DEFAULT_ENABLED_CATEGORIES,
  REFRESH_INTERVAL_OPTIONS,
  REGION_OPTIONS,
  useTrendSettings,
} from "@/components/useTrendSettings";
import type { TrendCategory } from "@/types/trend";

const selectableCategories = categories.filter((category) => category !== "全部") as TrendCategory[];

export function SettingsDashboard() {
  const { settings, setSettings, resetSettings, ready } = useTrendSettings();

  function toggleCategory(category: TrendCategory) {
    setSettings((current) => {
      const exists = current.enabledCategories.includes(category);
      const nextCategories = exists
        ? current.enabledCategories.filter((item) => item !== category)
        : [...current.enabledCategories, category];

      return {
        ...current,
        enabledCategories: nextCategories.length ? nextCategories : [category],
      };
    });
  }

  function selectAllCategories() {
    setSettings((current) => ({ ...current, enabledCategories: DEFAULT_ENABLED_CATEGORIES }));
  }

  function clearOptionalCategories() {
    setSettings((current) => ({ ...current, enabledCategories: ["新聞", "國際", "3C", "財經"] }));
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-950 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
            <Settings2 className="h-4 w-4" /> 系統設定
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">設定</h1>
          <p className="mt-2 max-w-3xl text-slate-600">
            這版會把偏好儲存在瀏覽器 localStorage。設定會影響首頁與熱門話題頁的資料筆數、最低熱度、分類顯示與 mock fallback。
          </p>
        </header>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">目前狀態</h2>
              <p className="mt-1 text-sm text-slate-600">
                {ready ? "設定已載入，修改後會自動保存。" : "正在讀取設定..."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={resetSettings}
                className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                <RotateCcw className="mr-2 h-4 w-4" /> 還原預設
              </button>
              <div className="inline-flex items-center rounded-2xl bg-slate-950 px-4 py-2 text-sm text-white">
                <Save className="mr-2 h-4 w-4" /> 自動保存中
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5" />
              <h2 className="text-lg font-semibold">資料與更新</h2>
            </div>

            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">地區</span>
                <select
                  value={settings.region}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, region: event.target.value as typeof settings.region }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                >
                  {REGION_OPTIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs text-slate-500">
                  目前先以前端過濾 RSS 分群結果；之後接資料庫可改成後端查詢條件。
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">更新頻率</span>
                <select
                  value={settings.refreshIntervalMinutes}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, refreshIntervalMinutes: Number(event.target.value) }))
                  }
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                >
                  {REFRESH_INTERVAL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">API 回傳上限：{settings.limit} 筆</span>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={settings.limit}
                  onChange={(event) => setSettings((current) => ({ ...current, limit: Number(event.target.value) }))}
                  className="mt-3 w-full"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">最低熱度分數：{settings.minScore}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={settings.minScore}
                  onChange={(event) => setSettings((current) => ({ ...current, minScore: Number(event.target.value) }))}
                  className="mt-3 w-full"
                />
              </label>

              <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={settings.useMockFallback}
                  onChange={(event) =>
                    setSettings((current) => ({ ...current, useMockFallback: event.target.checked }))
                  }
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-800">RSS 失敗時使用 mock fallback</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    開啟後，即使 RSS 暫時抓不到資料，首頁仍會顯示示範資料，避免空白頁。
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">啟用分類</h2>
                <p className="mt-1 text-sm text-slate-600">首頁與熱門話題頁會依照這裡勾選的分類顯示。</p>
              </div>
              <div className="flex gap-2">
                <button onClick={selectAllCategories} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs hover:bg-slate-200">
                  全選
                </button>
                <button onClick={clearOptionalCategories} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs hover:bg-slate-200">
                  精簡
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              {selectableCategories.map((category) => {
                const active = settings.enabledCategories.includes(category);
                return (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      active ? "border-slate-900 bg-slate-950 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <span>{category}</span>
                    {active && <CheckCircle2 className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="font-semibold">目前地區</h3>
            <div className="mt-3 text-3xl font-bold">{settings.region}</div>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="font-semibold">啟用分類數</h3>
            <div className="mt-3 text-3xl font-bold">{settings.enabledCategories.length}</div>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <h3 className="font-semibold">更新模式</h3>
            <div className="mt-3 text-3xl font-bold">
              {settings.refreshIntervalMinutes === 0 ? "手動" : `${settings.refreshIntervalMinutes}分`}
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h2 className="text-lg font-semibold">通知條件預留</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            下一階段可以把「熱度分數 ≥ 85、成長率 ≥ 150%、來源數 ≥ 3」做成通知規則，之後再接 Email、LINE Notify 或瀏覽器推播。
          </p>
        </section>
      </div>
    </main>
  );
}
