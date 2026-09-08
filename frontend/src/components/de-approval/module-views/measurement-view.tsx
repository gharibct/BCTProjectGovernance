"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { useParams } from "next/navigation";
import { Gauge } from "lucide-react";

import { useProject } from "@/lib/api/projects";
import { useProjectTypes, useReportingPeriods } from "@/lib/api/reference-data";
import {
  useDevelopmentMeasurements,
  useSupportMeasurements,
  useStaffingMeasurements,
  useTestingMeasurements,
  useConsultingMeasurements,
  useCloudMaintenanceMeasurements,
  useCloudMigrationMeasurements,
} from "@/lib/api/measurement";
import {
  useDevelopmentTarget,
  useSupportTarget,
  useStaffingTarget,
  useTestingTarget,
  useConsultingTarget,
  useCloudMaintenanceTarget,
  useCloudMigrationTarget,
} from "@/lib/api/metric-targets";
import { NativeSelect } from "@/components/ui/native-select";
import { SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { ReadOnlyValueGrid } from "./read-only-grid";

type Row = Record<string, unknown>;

function Snapshot({
  target,
  snapshots,
  periodKey,
}: {
  target: Row | null | undefined;
  // Every snapshot for this project, newest reporting-period first (API order).
  snapshots: Row[];
  // Period-based tabs key off a reporting_periods id; Cloud Migration is
  // event-based and keys off its own as_of_date column.
  periodKey: "period_id" | "as_of_date";
}) {
  const { data: periods = [] } = useReportingPeriods();
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);

  const options = snapshots.map((s) => {
    const value = String(s[periodKey] ?? "");
    const label =
      periodKey === "period_id"
        ? periods.find((p) => p.id === value)?.label ?? value
        : value;
    return { value, label };
  });

  const activeKey = selectedKey ?? options[0]?.value ?? null;
  const active = snapshots.find((s) => String(s[periodKey] ?? "") === activeKey) ?? null;

  const combo =
    options.length > 0 ? (
      <NativeSelect
        aria-label="Measurement period"
        wrapperClassName="w-auto"
        className="h-10 w-auto bg-white text-sm"
        value={activeKey ?? ""}
        onChange={(e) => setSelectedKey(e.target.value)}
      >
        {options.map((option, index) => (
          <option key={option.value} value={option.value}>
            {index === 0 ? `${option.label} (Latest)` : option.label}
          </option>
        ))}
      </NativeSelect>
    ) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <SectionCard icon={Gauge} title="Metric Targets">
        {target ? <ReadOnlyValueGrid data={target} /> : <EmptyState>No metric targets set.</EmptyState>}
      </SectionCard>
      <SectionCard icon={Gauge} title="Measurement Snapshot" aside={combo}>
        {active ? (
          <ReadOnlyValueGrid data={active} />
        ) : (
          <EmptyState>No measurement snapshot recorded yet.</EmptyState>
        )}
      </SectionCard>
    </div>
  );
}

function DevelopmentView({ projectId }: { projectId: string | null }) {
  const { data: snapshots = [] } = useDevelopmentMeasurements(projectId);
  return <Snapshot target={useDevelopmentTarget(projectId).data} snapshots={snapshots} periodKey="period_id" />;
}
function SupportView({ projectId }: { projectId: string | null }) {
  const { data: snapshots = [] } = useSupportMeasurements(projectId);
  return <Snapshot target={useSupportTarget(projectId).data} snapshots={snapshots} periodKey="period_id" />;
}
function StaffingView({ projectId }: { projectId: string | null }) {
  const { data: snapshots = [] } = useStaffingMeasurements(projectId);
  return <Snapshot target={useStaffingTarget(projectId).data} snapshots={snapshots} periodKey="period_id" />;
}
function TestingView({ projectId }: { projectId: string | null }) {
  const { data: snapshots = [] } = useTestingMeasurements(projectId);
  return <Snapshot target={useTestingTarget(projectId).data} snapshots={snapshots} periodKey="period_id" />;
}
function ConsultingView({ projectId }: { projectId: string | null }) {
  const { data: snapshots = [] } = useConsultingMeasurements(projectId);
  return <Snapshot target={useConsultingTarget(projectId).data} snapshots={snapshots} periodKey="period_id" />;
}
function CloudMaintenanceView({ projectId }: { projectId: string | null }) {
  const { data: snapshots = [] } = useCloudMaintenanceMeasurements(projectId);
  return (
    <Snapshot target={useCloudMaintenanceTarget(projectId).data} snapshots={snapshots} periodKey="period_id" />
  );
}
function CloudMigrationView({ projectId }: { projectId: string | null }) {
  const { data: snapshots = [] } = useCloudMigrationMeasurements(projectId);
  return (
    <Snapshot target={useCloudMigrationTarget(projectId).data} snapshots={snapshots} periodKey="as_of_date" />
  );
}

const VIEW_BY_CODE: Record<string, (props: { projectId: string | null }) => ReactElement> = {
  DEVELOPMENT: DevelopmentView,
  SUPPORT: SupportView,
  PROFESSIONAL_STAFFING: StaffingView,
  TESTING: TestingView,
  CONSULTING: ConsultingView,
  CLOUD_MAINTENANCE: CloudMaintenanceView,
  CLOUD_MIGRATION: CloudMigrationView,
};

export function MeasurementView() {
  const { projectId: rawProjectId } = useParams<{ projectId: string }>();
  const projectId = rawProjectId ?? null;
  const { data: project } = useProject(projectId);
  const { data: projectTypes } = useProjectTypes();

  const code = projectTypes?.find((t) => t.id === project?.project_type_id)?.code;
  const Active = code ? VIEW_BY_CODE[code] : undefined;

  if (!Active) {
    return <EmptyState>Set a Project Type on the Project Profile screen to see its measurement fields.</EmptyState>;
  }

  return <Active projectId={projectId} />;
}
