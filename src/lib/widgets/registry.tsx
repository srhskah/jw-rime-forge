"use client";

import type { ComponentType } from "react";
import { TextWidget } from "@/components/widgets/TextWidget";
import { NumberWidget } from "@/components/widgets/NumberWidget";
import { BooleanWidget } from "@/components/widgets/BooleanWidget";
import { SAFE_SCHEMA_FIELDS, type SchemaEditValue } from "@/lib/rime/schema";

export type WidgetProps = {
  id: string;
  label: string;
  value: SchemaEditValue | undefined;
  description?: string;
  onChange: (value: SchemaEditValue) => void;
  disabled?: boolean;
};

type WidgetKind = "text" | "number" | "boolean";

/**
 * Widget registry: field path → React component.
 * MVP: text / number / boolean only.
 * Future widgets: add a mapping here — do not change SchemaEditor core logic.
 */
export const WIDGET_COMPONENTS: Record<WidgetKind, ComponentType<WidgetProps>> = {
  text: TextWidget,
  number: NumberWidget,
  boolean: BooleanWidget,
};

export type RegisteredField = {
  path: string;
  label: string;
  widget: WidgetKind;
  description?: string;
  Component: ComponentType<WidgetProps>;
};

export function getRegisteredFields(): RegisteredField[] {
  return SAFE_SCHEMA_FIELDS.map((f) => ({
    ...f,
    Component: WIDGET_COMPONENTS[f.widget],
  }));
}

export function getWidgetForPath(path: string): RegisteredField | null {
  return getRegisteredFields().find((f) => f.path === path) ?? null;
}
