"use client";

import { useEffect } from "react";

type AdminSecretFieldProps = {
  value: string;
  onChange: (value: string) => void;
};

export function AdminSecretField({ value, onChange }: AdminSecretFieldProps) {
  useEffect(() => {
    onChange(localStorage.getItem("trendradar-admin-secret") ?? "");
  }, [onChange]);

  function updateValue(nextValue: string) {
    onChange(nextValue);
    localStorage.setItem("trendradar-admin-secret", nextValue);
  }

  return (
    <div className="rounded-3xl border border-amber-300/20 bg-amber-400/10 p-5">
      <label className="text-sm font-bold text-amber-100" htmlFor="adminSecret">Admin Secret</label>
      <input
        id="adminSecret"
        type="password"
        value={value}
        onChange={(event) => updateValue(event.target.value)}
        placeholder="Paste ADMIN_SECRET or CRON_SECRET"
        className="mt-3 w-full rounded-2xl border border-amber-300/20 bg-black px-4 py-3 font-mono text-sm text-white outline-none focus:border-amber-300"
      />
      <p className="mt-3 text-xs leading-6 text-amber-100/70">
        This is stored only in this browser and sent as x-admin-secret for admin API calls.
      </p>
    </div>
  );
}
