"use client";

import type { ReactElement } from "react";
import { useParams } from "next/navigation";
import { Gauge } from "lucide-react";

import { useProject } from "@/lib/api/projects";
import { useProjectTypes } from "@/lib/api/reference-data";
import {
  useLatestDevelopmentMeasurement,
  useLatestSupportMeasurement,
  useLatestStaffingMeasurement,
  useLatestTestingMeasurement,
  useLatestConsultingMeasurement,
  useLatestCloudMaintenanceMeasurement,
  useLatestCloudMigrationMeasurement,
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
import { SectionCard } from "@/components/forms/form-primitives";
import { EmptyState } from "@/components/forms/empty-state";
import { ReadOnlyValueGrid } from "./read-only-grid";

function Snapshot({
  target,
  snapshot,
}: {
  target: Record<string, unknown> | null | undefined;
  snapshot: Record<string, unknown> | null | undefined;
}) {
  return (
    <div className="flex flex-col gap-6">
      <SectionCard icon={Gauge} title="Metric Targets">
        {target ? <ReadOnlyValueGrid data={target} /> : <EmptyState>No metric targets set.</EmptyState>}
      </SectionCard>
      <SectionCard icon={Gauge} title="Latest Measurement Snapshot">
        {snapshot ? (
          <ReadOnlyValueGrid data={snapshot} />
        ) : (
          <EmptyState>No measurement snapshot recorded yet.</EmptyState>
        )}
      </SectionCard>
    </div>
  );
}

function DevelopmentView({ projectId }: { projectId: string | null }) {
  return <Snapshot target={useDevelopmentTarget(projectId).data} snapshot={useLatestDevelopmentMeasurement(projectId).data} />;
}
function SupportView({ projectId }: { projectId: string | null }) {
  return <Snapshot target={useSupportTarget(projectId).data} snapshot={useLatestSupportMeasurement(projectId).data} />;
}
function StaffingView({ projectId }: { projectId: string | null }) {
  return <Snapshot target={useStaffingTarget(projectId).data} snapshot={useLatestStaffingMeasurement(projectId).data} />;
}
function TestingView({ projectId }: { projectId: string | null }) {
  return <Snapshot target={useTestingTarget(projectId).data} snapshot={useLatestTestingMeasurement(projectId).data} />;
}
function ConsultingView({ projectId }: { projectId: string | null }) {
  return <Snapshot target={useConsultingTarget(projectId).data} snapshot={useLatestConsultingMeasurement(projectId).data} />;
}
function CloudMaintenanceView({ projectId }: { projectId: string | null }) {
  return (
    <Snapshot
      target={useCloudMaintenanceTarget(projectId).data}
      snapshot={useLatestCloudMaintenanceMeasurement(projectId).data}
    />
  );
}
function CloudMigrationView({ projectId }: { projectId: string | null }) {
  return (
    <Snapshot
      target={useCloudMigrationTarget(projectId).data}
      snapshot={useLatestCloudMigrationMeasurement(projectId).data}
    />
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
