"use client";

import * as React from "react";
import { Map as MapIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { usePageBanner } from "@/stores/page-banner";
import { useGeos, useRegions, type Region } from "@/lib/api/reference-data";
import { useCreateRegion, useDeleteRegion, useUpdateRegion, type RegionPayload } from "@/lib/api/regions";

function toValues(region: Region): Record<string, string> {
  return {
    geo_id: region.geo_id,
    code: region.code,
    name: region.name,
    is_active: region.is_active ? "Yes" : "No",
  };
}

function buildRegionPayload(values: Record<string, string>): RegionPayload {
  return {
    geo_id: values.geo_id,
    code: values.code,
    name: values.name,
    is_active: values.is_active !== "No",
  };
}

export function CreateRegionPanel() {
  const { data: regions = [] } = useRegions();
  const { data: geos = [] } = useGeos();

  const { values, set, reset, load } = useEntryValues();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const createRegion = useCreateRegion();
  const updateRegion = useUpdateRegion();
  const deleteRegion = useDeleteRegion();
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const geoName = (id: string | null) => geos.find((g) => g.id === id)?.name ?? "—";

  const fields: FieldDef[] = [
    {
      key: "geo_id",
      label: "Geo",
      kind: "select",
      mandatory: true,
      choices: geos.map((g) => ({ value: g.id, label: g.name })),
    },
    { key: "code", label: "Region Code", kind: "text", mandatory: true },
    { key: "name", label: "Region Name", kind: "text", mandatory: true },
    { key: "is_active", label: "Active", kind: "select", options: ["Yes", "No"] },
  ];

  const startEdit = (region: Region) => {
    setEditingId(region.id);
    load(toValues(region));
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
  };

  const handleDelete = (region: Region) => {
    deleteRegion.mutate(region.id, {
      onSuccess: () => {
        if (editingId === region.id) cancelEdit();
        showSuccess("Region Deleted Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete region."),
    });
  };

  async function submit() {
    if (!values.geo_id || !values.code?.trim() || !values.name?.trim()) return;
    const payload = buildRegionPayload(values);

    try {
      if (editingId) {
        await updateRegion.mutateAsync({ id: editingId, payload });
        cancelEdit();
        showSuccess("Region Updated Successfully");
      } else {
        await createRegion.mutateAsync(payload);
        reset();
        showSuccess("Region Created Successfully");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save region.");
    }
  }

  const busy = createRegion.isPending || updateRegion.isPending;

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={MapIcon} title="Region Directory">
        <RegisterTable
          items={regions}
          emptyLabel="No regions yet."
          onEdit={startEdit}
          onDelete={handleDelete}
          columns={[
            { key: "geo_id", label: "Geo", render: (item) => geoName(item.geo_id) },
            { key: "code", label: "Region Code" },
            { key: "name", label: "Region Name" },
            {
              key: "is_active",
              label: "Active",
              render: (item) => (item.is_active ? "Yes" : "No"),
            },
          ]}
        />
      </SectionCard>

      <SectionCard icon={MapIcon} title={editingId ? "Edit Region" : "New Region"}>
        <EntryFields defs={fields} values={values} set={set} />
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
            {editingId ? "Save Changes" : "Add Region"}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
