"use client";

import type { WidgetProps } from "@/lib/widgets/registry";

export function NumberWidget({
  id,
  label,
  value,
  description,
  onChange,
  disabled,
}: WidgetProps) {
  const num =
    typeof value === "number"
      ? value
      : value === undefined || value === null || value === ""
        ? ""
        : Number(value);

  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
      {description ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
      ) : null}
      <input
        id={id}
        type="number"
        disabled={disabled}
        value={num}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") onChange(null);
          else onChange(Number(v));
        }}
        className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-teal-600/30 focus:ring-2 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </label>
  );
}
