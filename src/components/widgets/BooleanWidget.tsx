"use client";

import type { WidgetProps } from "@/lib/widgets/registry";

export function BooleanWidget({
  id,
  label,
  value,
  description,
  onChange,
  disabled,
}: WidgetProps) {
  const checked = Boolean(value);
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-teal-600" : "bg-zinc-300 dark:bg-zinc-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <div className="flex flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {label}
        </label>
        {description ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
        ) : null}
      </div>
    </div>
  );
}
