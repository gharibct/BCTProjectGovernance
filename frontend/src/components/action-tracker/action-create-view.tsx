"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Field, ButtonSpinner, MandatoryBadge, Segmented } from "@/components/forms/form-primitives";
import { ResourcePicker } from "@/components/forms/resource-picker";
import { useAccounts, useGeos } from "@/lib/api/reference-data";
import { useAccountHead, useGeoHead } from "@/lib/api/users";
import { useProject, useProjects } from "@/lib/api/projects";
import { useCreateAction, type ActionLevel, type ActionPriority } from "@/lib/api/actions";
import { usePageBanner } from "@/stores/page-banner";
import { useSession } from "@/stores/session";

const LEVELS: ActionLevel[] = ["GEO", "ACCOUNT", "PROJECT"];
const LEVEL_LABEL: Record<ActionLevel, string> = { GEO: "Geo Review", ACCOUNT: "Account Review", PROJECT: "Project Review" };

const PRIORITIES = [
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
] as const;

type ValueOption = { id: string; name: string };

export function ActionCreateView({
  level: initialLevel,
  id: initialId,
  onDone,
}: {
  level: ActionLevel;
  id: string;
  name: string;
  onDone: () => void;
}) {
  const { data: geos = [] } = useGeos();
  const { data: accounts = [] } = useAccounts();
  const { data: projects = [] } = useProjects();
  const sessionUser = useSession((s) => s.user);

  // Action creation is open to any authenticated user at any level: the Level
  // combo offers all three (Geo / Account / Project) on every screen and each
  // level lists every entity. The screen context only decides which level +
  // entity are pre-selected (see initialLevel / initialId).
  const geoOptions: ValueOption[] = geos.map((g) => ({ id: g.id, name: g.name }));
  const accountOptions: ValueOption[] = accounts.map((a) => ({ id: a.id, name: a.name }));
  const projectOptions: ValueOption[] = projects.map((p) => ({ id: p.id, name: p.project_name || p.project_code }));

  const optionsForLevel = (l: ActionLevel): ValueOption[] =>
    l === "GEO" ? geoOptions : l === "ACCOUNT" ? accountOptions : projectOptions;

  const [selectedLevel, setSelectedLevel] = React.useState<ActionLevel>(initialLevel);
  const [selectedValueId, setSelectedValueId] = React.useState<string>(initialId);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  // "" = follow derivedOwnerId; ownerTouched flips once the user picks someone.
  const [ownerId, setOwnerId] = React.useState("");
  const [ownerTouched, setOwnerTouched] = React.useState(false);
  const [dueDate, setDueDate] = React.useState("");
  const [priority, setPriority] = React.useState<ActionPriority>("HIGH");
  const [errors, setErrors] = React.useState<{ title?: string; due_date?: string; value?: string }>({});

  const currentOptions = optionsForLevel(selectedLevel);
  const selectedValue = currentOptions.find((o) => o.id === selectedValueId);

  const changeLevel = (nextLevel: ActionLevel) => {
    setSelectedLevel(nextLevel);
    setSelectedValueId(optionsForLevel(nextLevel)[0]?.id ?? "");
    // Let the new level's derived owner take over (unless the user re-picks).
    setOwnerId("");
    setOwnerTouched(false);
  };

  const { data: project } = useProject(selectedLevel === "PROJECT" ? selectedValueId || null : null);
  const { data: geoHead } = useGeoHead(selectedLevel === "GEO" ? selectedValueId || null : null);
  const { data: accountHead } = useAccountHead(selectedLevel === "ACCOUNT" ? selectedValueId || null : null);
  const createAction = useCreateAction(selectedLevel, selectedValueId || null);
  const showError = usePageBanner((s) => s.showError);
  const showSuccess = usePageBanner((s) => s.showSuccess);

  // action_by_id is mandatory (design-reference/action-table-design.md): no
  // blank "Unassigned" option. Default the owner from the entity itself —
  // Geo Owner (GEO) / Account Head (ACCOUNT) / Project Manager (PROJECT) —
  // falling back to the creator when that role isn't mapped yet. Overridable.
  const derivedOwnerId =
    (selectedLevel === "PROJECT"
      ? project?.project_manager_id
      : selectedLevel === "GEO"
        ? geoHead?.id
        : accountHead?.id) ||
    sessionUser?.id ||
    "";

  // Commit the derived default into the actual select value once it resolves
  // (the lookups above are async) so the "Assign To" combo is always
  // populated — never left blank while project / geo-head / account-head load.
  React.useEffect(() => {
    if (!ownerTouched && derivedOwnerId) setOwnerId(derivedOwnerId);
  }, [derivedOwnerId, ownerTouched]);

  const submit = () => {
    const nextErrors: typeof errors = {};
    if (!title.trim()) nextErrors.title = "Title is required.";
    if (!dueDate) nextErrors.due_date = "Due date is required.";
    if (!selectedValueId) nextErrors.value = `Pick a ${LEVEL_LABEL[selectedLevel]} entity.`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    createAction.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        action_by_id: ownerId || derivedOwnerId || null,
        due_date: dueDate,
      },
      {
        onSuccess: () => {
          showSuccess("Action created.");
          onDone();
        },
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to create action."),
      }
    );
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <p className="text-xs text-slate-400">
        Source: {LEVEL_LABEL[selectedLevel]} <span className="mx-1">›</span> {selectedValue?.name ?? "—"}
      </p>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Level" htmlFor="action-level" badge={<MandatoryBadge />}>
          <NativeSelect
            id="action-level"
            value={selectedLevel}
            onChange={(e) => changeLevel(e.target.value as ActionLevel)}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l.charAt(0) + l.slice(1).toLowerCase()}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={LEVEL_LABEL[selectedLevel].replace(" Review", "")} htmlFor="action-value" badge={<MandatoryBadge />} error={errors.value}>
          <NativeSelect id="action-value" value={selectedValueId} onChange={(e) => setSelectedValueId(e.target.value)}>
            {currentOptions.length === 0 ? <option value="">None available</option> : null}
            {currentOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field label="Action Title" htmlFor="action-title" badge={<MandatoryBadge />} error={errors.title}>
        <Input id="action-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to happen?" />
      </Field>

      <Field label="Description" htmlFor="action-description">
        <Textarea
          id="action-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Add more detail (optional)"
        />
      </Field>

      <Field label="Assign To" htmlFor="action-owner" badge={<MandatoryBadge />}>
        <ResourcePicker
          id="action-owner"
          value={ownerId || derivedOwnerId || null}
          onChange={(id) => {
            setOwnerTouched(true);
            setOwnerId(id ?? "");
          }}
          // Only the session user's own name is known without a lookup; for
          // anyone else (a derived project PM / geo head, or a picked person)
          // let the picker resolve the name by id.
          initialLabel={
            (ownerId || derivedOwnerId) === sessionUser?.id
              ? sessionUser?.full_name
              : undefined
          }
          placeholder="Search people…"
        />
      </Field>

      <Field label="Due Date" htmlFor="action-due-date" badge={<MandatoryBadge />} error={errors.due_date}>
        <Input id="action-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>

      <Field label="Priority">
        <Segmented options={PRIORITIES} value={priority} onChange={setPriority} className="w-full" />
      </Field>

      <div className="mt-2 flex justify-end gap-3">
        <Button variant="outline" onClick={onDone} disabled={createAction.isPending}>
          Cancel
        </Button>
        <Button
          onClick={submit}
          disabled={createAction.isPending || !selectedValueId}
          className="gap-2"
        >
          {createAction.isPending ? <ButtonSpinner /> : null}
          Create Action
        </Button>
      </div>
    </div>
  );
}
