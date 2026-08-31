"use client";

import * as React from "react";

import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, MandatoryBadge } from "./form-primitives";

export type FieldKind = "text" | "number" | "date" | "select" | "textarea";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  // Enum-style select: option value === option label.
  options?: readonly string[];
  // FK-backed select (e.g. a user picker): value is the referenced row's id,
  // label is its display name. Takes precedence over `options` when set.
  choices?: readonly { value: string; label: string }[];
  hint?: string;
  mandatory?: boolean;
  placeholder?: string;
};

type ChangeEvent = React.ChangeEvent<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
>;

// Declarative field-list engine backing every RAIDO "New <Item>" form — a
// log's shape is just an array of FieldDefs; this renders and manages it so
// each log file only needs to state its fields (per §4.5–4.9 of the spec),
// not re-implement a form.
export function useEntryValues() {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const set = (key: string) => (e: ChangeEvent) =>
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
  const reset = () => setValues({});
  // Bulk-populate from an existing row — used when editing a register entry.
  const load = (next: Record<string, string>) => setValues(next);
  return { values, set, reset, load };
}

// Edit-in-place state shared by every RAIDO register: tracks which row (by
// id) is being edited, populating the entry form from it via `load` and
// clearing back to a blank form via `reset` on cancel.
export function useEditableEntry<T extends { id: string }>(
  load: (values: Record<string, string>) => void,
  reset: () => void,
  toValues: (item: T) => Record<string, string>
) {
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const startEdit = (item: T) => {
    setEditingId(item.id);
    load(toValues(item));
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
  };

  return { editingId, startEdit, cancelEdit };
}

function renderControl(
  def: FieldDef,
  value: string,
  onChange: (e: ChangeEvent) => void
) {
  switch (def.kind) {
    case "select":
      return (
        <NativeSelect id={def.key} value={value} onChange={onChange}>
          <option value="" disabled>
            Select…
          </option>
          {def.choices
            ? def.choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))
            : def.options?.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
        </NativeSelect>
      );
    case "textarea":
      return (
        <Textarea
          id={def.key}
          value={value}
          onChange={onChange}
          placeholder={def.placeholder}
        />
      );
    case "date":
      return (
        <Input
          id={def.key}
          type="date"
          value={value}
          onChange={onChange}
          className="h-11"
        />
      );
    case "number":
      return (
        <Input
          id={def.key}
          type="number"
          value={value}
          onChange={onChange}
          className="h-11"
        />
      );
    default:
      return (
        <Input
          id={def.key}
          value={value}
          onChange={onChange}
          placeholder={def.placeholder}
          className="h-11"
        />
      );
  }
}

export function EntryFields({
  defs,
  values,
  set,
  errors,
}: {
  defs: FieldDef[];
  values: Record<string, string>;
  set: (key: string) => (e: ChangeEvent) => void;
  // Optional field-level validation messages, keyed by FieldDef.key — see
  // Field's own `error` prop. Undefined/omitted renders exactly as before.
  errors?: Record<string, string>;
}) {
  const gridDefs = defs.filter((d) => d.kind !== "textarea");
  const textDefs = defs.filter((d) => d.kind === "textarea");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
        {gridDefs.map((def) => (
          <Field
            key={def.key}
            label={def.label}
            htmlFor={def.key}
            hint={def.hint}
            badge={def.mandatory ? <MandatoryBadge /> : undefined}
            error={errors?.[def.key]}
          >
            {renderControl(def, values[def.key] ?? "", set(def.key))}
          </Field>
        ))}
      </div>
      {textDefs.map((def) => (
        <Field
          key={def.key}
          label={def.label}
          htmlFor={def.key}
          hint={def.hint}
          badge={def.mandatory ? <MandatoryBadge /> : undefined}
          error={errors?.[def.key]}
        >
          {renderControl(def, values[def.key] ?? "", set(def.key))}
        </Field>
      ))}
    </div>
  );
}

export function useIdCounter(prefix: string) {
  const counter = React.useRef(0);
  return React.useCallback(() => {
    counter.current += 1;
    return `${prefix}-${String(counter.current).padStart(4, "0")}`;
  }, [prefix]);
}
