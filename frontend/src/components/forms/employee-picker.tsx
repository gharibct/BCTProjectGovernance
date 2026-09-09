"use client";

import * as React from "react";

import { fetchUserById, fetchUserOptions, type User } from "@/lib/api/reference-data";
import { FilteredCombo, type ComboItem } from "@/components/forms/filtered-combo";

// Ready-to-use person selector built on FilteredCombo: a searchable combo plus a
// name/keyword filter popup with a live result count, all resolved server-side
// via GET /users?search=&role_code=&is_active=true. Use this wherever a plain
// <select> over the whole directory would be too long. (Mirrors how ProjectPicker
// wraps FilteredCombo for projects, and how ResourcePicker wraps the lighter
// combo internals for people.)

function toItem(u: User): ComboItem {
  return { id: u.id, primary: u.full_name, secondary: u.email };
}

export function EmployeePicker({
  value,
  onChange,
  roleCode,
  roleCodes,
  label,
  placeholder = "Search people…",
  searchPlaceholder = "Search people…",
  required = false,
  disabled = false,
  id,
  className,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  /** Restrict the directory to one role, e.g. "PROJECT_MANAGER". */
  roleCode?: string;
  /** Restrict to any-of these roles (takes precedence over `roleCode`). */
  roleCodes?: readonly string[];
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <FilteredCombo
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      disabled={disabled}
      id={id}
      className={className}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      searchLabel="Name / keyword"
      queryKey={["users", "filtered-combo", roleCodes?.join(",") ?? roleCode ?? "all"]}
      fetchOptions={async ({ search, limit }) => {
        const page = await fetchUserOptions({ search, roleCode, roleCodes, limit });
        return { items: page.items.map(toItem), total: page.total };
      }}
      resolveSelected={async (selectedId) => {
        const u = await fetchUserById(selectedId);
        return u ? toItem(u) : undefined;
      }}
    />
  );
}
