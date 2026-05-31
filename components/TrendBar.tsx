"use client";

import { motion } from "framer-motion";

export function TrendBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        transition={{ duration: 0.7 }}
        className="h-2 rounded-full bg-slate-900"
      />
    </div>
  );
}
