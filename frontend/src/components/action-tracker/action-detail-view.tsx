"use client";

import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, Field, Segmented } from "@/components/forms/form-primitives";
import { StatusBadge } from "@/components/forms/status-badge";
import { ResourcePicker } from "@/components/forms/resource-picker";
import { useUsersByIds, type User } from "@/lib/api/reference-data";
import { canCreateAction, canTransitionAction } from "@/lib/api/action-permissions";
import {
  ACTION_PRIORITY_LABEL,
  ACTION_STATUS_LABEL,
  useActionHistory,
  useActions,
  useAddActionComment,
  useCancelAction,
  useCloseAction,
  useCompleteAction,
  useStartAction,
  useUpdateAction,
  type Action,
  type ActionHistoryEntry,
  type ActionLevel,
  type ActionPriority,
} from "@/lib/api/actions";
import { usePageBanner } from "@/stores/page-banner";
import { useEffectiveRole, useSession } from "@/stores/session";

const PRIORITIES = [
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
] as const;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function userName(users: User[], userId: string): string {
  return users.find((u) => u.id === userId)?.full_name ?? "Unknown";
}

function describeHistoryEntry(entry: ActionHistoryEntry, users: User[]): string {
  switch (entry.event_type) {
    case "CREATED":
      return "Action created";
    case "STATUS_CHANGE":
      return `Status changed from ${ACTION_STATUS_LABEL[entry.old_value as keyof typeof ACTION_STATUS_LABEL] ?? entry.old_value} to ${ACTION_STATUS_LABEL[entry.new_value as keyof typeof ACTION_STATUS_LABEL] ?? entry.new_value}`;
    case "OWNER_CHANGE":
      return `Owner changed from ${entry.old_value ? userName(users, entry.old_value) : "Unassigned"} to ${entry.new_value ? userName(users, entry.new_value) : "Unassigned"}`;
    case "DUE_DATE_CHANGE":
      return `Due date changed from ${entry.old_value ? formatDate(entry.old_value) : "—"} to ${entry.new_value ? formatDate(entry.new_value) : "—"}`;
    case "PRIORITY_CHANGE":
      return `Priority changed from ${ACTION_PRIORITY_LABEL[entry.old_value as keyof typeof ACTION_PRIORITY_LABEL] ?? entry.old_value} to ${ACTION_PRIORITY_LABEL[entry.new_value as keyof typeof ACTION_PRIORITY_LABEL] ?? entry.new_value}`;
    case "COMMENT":
    default:
      return entry.comment ?? "";
  }
}

export function ActionDetailView({
  level,
  id,
  actionId,
  onBack,
}: {
  level: ActionLevel;
  id: string;
  actionId: string;
  onBack: () => void;
}) {
  const { data: actions = [] } = useActions(level, id);
  const action = actions.find((a) => a.id === actionId);
  const { data: history = [] } = useActionHistory(level, id, actionId);
  const user = useSession((s) => s.user);
  const effectiveRole = useEffectiveRole();
  const updateAction = useUpdateAction(level, id);
  const startAction = useStartAction(level, id);
  const completeAction = useCompleteAction(level, id);
  const closeAction = useCloseAction(level, id);
  const cancelAction = useCancelAction(level, id);
  const addComment = useAddActionComment(level, id);
  const showSuccess = usePageBanner((s) => s.showSuccess);
  const showError = usePageBanner((s) => s.showError);

  // This view only mounts once the user has selected a card from the list,
  // whose query already populated the cache `action` reads from — so these
  // lazy initializers see real data on first render (no effect needed; the
  // list<->detail view switch in action-tracker-drawer.tsx unmounts/remounts
  // this component on every new selection, resetting the edit buffer).
  const [title, setTitle] = React.useState(() => action?.title ?? "");
  const [description, setDescription] = React.useState(() => action?.description ?? "");
  const [ownerId, setOwnerId] = React.useState(() => action?.action_by_id ?? "");
  const [dueDate, setDueDate] = React.useState(() => action?.due_date ?? "");
  const [priority, setPriority] = React.useState<ActionPriority>(() => action?.priority ?? "MEDIUM");
  const [commentText, setCommentText] = React.useState("");

  // Every name shown on this view (owner, raiser, closer, history authors and
  // OWNER_CHANGE from/to) is a bare user id — resolve just those, not the
  // whole directory.
  const nameIds = React.useMemo(
    () => [
      ownerId,
      action?.action_by_id,
      action?.raised_by,
      action?.closed_by,
      ...history.flatMap((h) => [
        h.created_by,
        h.event_type === "OWNER_CHANGE" ? h.old_value : null,
        h.event_type === "OWNER_CHANGE" ? h.new_value : null,
      ]),
    ],
    [ownerId, action?.action_by_id, action?.raised_by, action?.closed_by, history],
  );
  const { data: users = [] } = useUsersByIds(nameIds);

  if (!action) {
    return (
      <div className="p-6">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]">
          <ArrowLeft className="size-4" />
          Back to Actions
        </button>
        <p className="mt-6 text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  const typedAction: Action = action;
  const canEdit = canCreateAction(level, effectiveRole);
  const canTransition = canTransitionAction(level, typedAction, user?.id, effectiveRole);
  const isOpenOrInProgress = action.status === "OPEN" || action.status === "IN_PROGRESS";

  const saveChanges = () => {
    updateAction.mutate(
      {
        actionId: action.id,
        payload: { title: title.trim(), description: description.trim() || null, action_by_id: ownerId || null, due_date: dueDate, priority },
      },
      {
        onSuccess: () => showSuccess("Action updated."),
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to update action."),
      }
    );
  };

  const runTransition = (
    mutation: typeof startAction,
    successMessage: string,
    failureMessage: string
  ) => {
    mutation.mutate(action.id, {
      onSuccess: () => showSuccess(successMessage),
      onError: (err) => showError(err instanceof Error ? err.message : failureMessage),
    });
  };

  const postComment = () => {
    if (!commentText.trim()) return;
    addComment.mutate(
      { actionId: action.id, text: commentText.trim() },
      {
        onSuccess: () => setCommentText(""),
        onError: (err) => showError(err instanceof Error ? err.message : "Failed to post comment."),
      }
    );
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-semibold text-[#1a6fc4]">
        <ArrowLeft className="size-4" />
        Back to Actions
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-slate-400">{action.action_code}</span>
        <StatusBadge value={ACTION_STATUS_LABEL[action.status]} />
        {action.overdue ? <span className="text-xs font-semibold text-red-600">Overdue</span> : null}
      </div>

      <Field label="Action Title" htmlFor="detail-title">
        <Input id="detail-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
      </Field>

      <Field label="Description" htmlFor="detail-description">
        <Textarea id="detail-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} disabled={!canEdit} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Owner" htmlFor="detail-owner">
          <ResourcePicker
            id="detail-owner"
            value={ownerId || null}
            onChange={(id) => setOwnerId(id ?? "")}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Due Date" htmlFor="detail-due-date">
          <Input id="detail-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canEdit} />
        </Field>
      </div>

      <Field label="Priority">
        <Segmented options={PRIORITIES} value={priority} onChange={setPriority} className="w-full" disabled={!canEdit} />
      </Field>

      <dl className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
        <div>
          <dt className="font-semibold text-slate-400 uppercase">Raised</dt>
          <dd className="mt-1 text-slate-700">
            {formatDate(action.raised_at)} by {userName(users, action.raised_by)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-400 uppercase">Last Updated</dt>
          <dd className="mt-1 text-slate-700">{formatDate(action.updated_at)}</dd>
        </div>
        {action.closed_by ? (
          <div>
            <dt className="font-semibold text-slate-400 uppercase">Closed By</dt>
            <dd className="mt-1 text-slate-700">{userName(users, action.closed_by)}</dd>
          </div>
        ) : null}
      </dl>

      {canEdit ? (
        <Button onClick={saveChanges} disabled={updateAction.isPending} className="gap-2 self-start">
          {updateAction.isPending ? <ButtonSpinner /> : null}
          Save Changes
        </Button>
      ) : null}

      {canTransition && isOpenOrInProgress ? (
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5">
          {action.status === "OPEN" ? (
            <Button
              onClick={() => runTransition(startAction, "Action started.", "Failed to start action.")}
              disabled={startAction.isPending}
              className="gap-2"
            >
              {startAction.isPending ? <ButtonSpinner /> : null}
              Start Progress
            </Button>
          ) : null}
          <Button
            onClick={() => runTransition(completeAction, "Action marked complete.", "Failed to complete action.")}
            disabled={completeAction.isPending}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {completeAction.isPending ? <ButtonSpinner /> : null}
            Mark Complete
          </Button>
          <Button
            onClick={() => runTransition(cancelAction, "Action cancelled.", "Failed to cancel action.")}
            disabled={cancelAction.isPending}
            variant="destructive"
            className="gap-2"
          >
            {cancelAction.isPending ? <ButtonSpinner /> : null}
            Cancel Action
          </Button>
        </div>
      ) : null}

      {canTransition && action.status === "COMPLETED" ? (
        <div className="flex gap-3 border-t border-slate-200 pt-5">
          <Button
            onClick={() => runTransition(closeAction, "Action closed.", "Failed to close action.")}
            disabled={closeAction.isPending}
            variant="outline"
            className="gap-2"
          >
            {closeAction.isPending ? <ButtonSpinner /> : null}
            Close Action
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-5">
        <p className="text-sm font-bold text-slate-800">Progress &amp; History</p>
        {canTransition ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={2}
              placeholder="Add a progress update or comment…"
            />
            <Button
              size="sm"
              onClick={postComment}
              disabled={addComment.isPending || !commentText.trim()}
              className="gap-2 self-end"
            >
              {addComment.isPending ? <ButtonSpinner /> : null}
              Post
            </Button>
          </div>
        ) : null}
        <ul className="flex flex-col gap-3">
          {history.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-0.5 text-xs">
              <span className={entry.event_type === "COMMENT" ? "text-slate-700" : "text-slate-400 italic"}>
                {describeHistoryEntry(entry, users)}
              </span>
              <span className="text-slate-400">
                {formatDateTime(entry.created_at)} · {userName(users, entry.created_by)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
