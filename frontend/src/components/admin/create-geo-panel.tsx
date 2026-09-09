"use client";

import * as React from "react";
import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner, Field, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { RegisterImportToolbar } from "@/components/forms/register-import-toolbar";
import { ResourcePicker } from "@/components/forms/resource-picker";
import { usePageBanner } from "@/stores/page-banner";
import { useGeos, type Geo } from "@/lib/api/reference-data";
import { useCreateGeo, useDeleteGeo, useUpdateGeo, type GeoPayload } from "@/lib/api/geos";
import { useGeoHead, useSetGeoHead } from "@/lib/api/users";

function toValues(geo: Geo): Record<string, string> {
  return {
    code: geo.code,
    name: geo.name,
    is_active: geo.is_active ? "Yes" : "No",
    tool_effective_date: geo.tool_effective_date ?? "",
  };
}

function buildGeoPayload(values: Record<string, string>): GeoPayload {
  return {
    code: values.code,
    name: values.name,
    is_active: values.is_active !== "No",
    tool_effective_date: values.tool_effective_date || undefined,
  };
}

export function CreateGeoPanel() {
  const { data: geos = [] } = useGeos();

  const { values, set, reset, load } = useEntryValues();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  // Geo Head — optional single owner, persisted via the geo-head endpoint
  // (a user_geos link), not part of GeoPayload.
  const [geoHeadId, setGeoHeadId] = React.useState<string | null>(null);
  const createGeo = useCreateGeo();
  const updateGeo = useUpdateGeo();
  const deleteGeo = useDeleteGeo();
  const setGeoHead = useSetGeoHead();
  const { data: editingHead } = useGeoHead(editingId);
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  // Seed the picker once the current head arrives for this editingId (setState
  // during render, guarded by `syncedFor` — same pattern as create-user-panel).
  const [syncedHeadFor, setSyncedHeadFor] = React.useState<string | null>(null);
  if (editingId && editingId !== syncedHeadFor && editingHead !== undefined) {
    setSyncedHeadFor(editingId);
    setGeoHeadId(editingHead?.id ?? null);
  }

  const fields: FieldDef[] = [
    { key: "code", label: "Geo Code", kind: "text", mandatory: true },
    { key: "name", label: "Geo Name", kind: "text", mandatory: true },
    { key: "is_active", label: "Active", kind: "select", options: ["Yes", "No"] },
    {
      key: "tool_effective_date",
      label: "Governance Tool Implementation Effective Date",
      kind: "date",
      hint: "When this geo started being tracked in the tool. Leave blank for no restriction.",
    },
  ];

  const startEdit = (geo: Geo) => {
    setEditingId(geo.id);
    load(toValues(geo));
    setGeoHeadId(null);
    setSyncedHeadFor(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
    setGeoHeadId(null);
    setSyncedHeadFor(null);
  };

  const handleDelete = (geo: Geo) => {
    deleteGeo.mutate(geo.id, {
      onSuccess: () => {
        if (editingId === geo.id) cancelEdit();
        showSuccess("Geo Deleted Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete geo."),
    });
  };

  async function submit() {
    if (!values.code?.trim() || !values.name?.trim()) return;
    const payload = buildGeoPayload(values);

    try {
      if (editingId) {
        await updateGeo.mutateAsync({ id: editingId, payload });
        await setGeoHead.mutateAsync({ geoId: editingId, userId: geoHeadId });
        cancelEdit();
        showSuccess("Geo Updated Successfully");
      } else {
        const created = await createGeo.mutateAsync(payload);
        if (geoHeadId) {
          await setGeoHead.mutateAsync({ geoId: created.id, userId: geoHeadId });
        }
        reset();
        setGeoHeadId(null);
        showSuccess("Geo Created Successfully");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save geo.");
    }
  }

  const busy = createGeo.isPending || updateGeo.isPending || setGeoHead.isPending;

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Globe} title="Geo Directory">
        <RegisterImportToolbar
          defs={fields}
          itemLabelPlural="Geos"
          buildPayload={buildGeoPayload}
          createMutation={createGeo}
        />
        <RegisterTable
          items={geos}
          emptyLabel="No geos yet."
          onEdit={startEdit}
          onDelete={handleDelete}
          columns={[
            { key: "code", label: "Geo Code" },
            { key: "name", label: "Geo Name" },
            {
              key: "is_active",
              label: "Active",
              render: (item) => (item.is_active ? "Yes" : "No"),
            },
            {
              key: "tool_effective_date",
              label: "Tool Effective Date",
              render: (item) => item.tool_effective_date || "—",
            },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Globe} title={editingId ? "Edit Geo" : "New Geo"}>
        <EntryFields defs={fields} values={values} set={set} />
        <div className="mt-6 max-w-md">
          <Field
            label="Geo Head"
            hint="Optional. The Geo Head who owns this geo. Can be changed later on Reassign Owners."
          >
            <ResourcePicker
              value={geoHeadId}
              onChange={setGeoHeadId}
              roleCode="GEO_HEAD"
              placeholder="Select Geo Head…"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          {editingId ? (
            <Button variant="outline" className="h-11 px-6 text-sm font-semibold" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
          <Button
            onClick={submit}
            disabled={busy}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {busy ? <ButtonSpinner /> : null}
            {editingId ? "Save Changes" : "Add Geo"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
