"use client";

import * as React from "react";
import { Database } from "lucide-react";

import {
  AutoBadge,
  Field,
  MandatoryBadge,
  SectionCard,
} from "@/components/forms/form-primitives";
import { RegisterTable } from "@/components/forms/register-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Oracle Project ID is entered by the PM; Project Description is never
// typed — it's fetched via the BCT Oracle App integration once synced.
type OracleMapping = {
  id: string;
  oracleProjectId: string;
  description: string;
};

export function OracleMappingForm() {
  const seq = React.useRef(0);
  const [items, setItems] = React.useState<OracleMapping[]>([]);
  const [oracleProjectId, setOracleProjectId] = React.useState("");

  const addMapping = () => {
    if (!oracleProjectId.trim()) return;
    seq.current += 1;
    setItems((prev) => [
      ...prev,
      {
        id: `oracle-${seq.current}`,
        oracleProjectId,
        description: "",
      },
    ]);
    setOracleProjectId("");
  };

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        icon={Database}
        title="Oracle Projects Register"
        aside={<AutoBadge label={`${items.length} mapped`} />}
      >
        <RegisterTable
          items={items}
          emptyLabel="No Oracle Project IDs mapped yet."
          columns={[
            { key: "oracleProjectId", label: "Oracle Project ID" },
            {
              key: "description",
              label: "Project Description",
              render: () => (
                <span className="text-slate-400 italic">Pending Oracle sync…</span>
              ),
            },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Database} title="New Oracle Project">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
          <Field
            label="Oracle Project ID"
            htmlFor="oracle-project-id"
            badge={<MandatoryBadge />}
          >
            <Input
              id="oracle-project-id"
              placeholder="e.g. ORA-88121"
              value={oracleProjectId}
              onChange={(e) => setOracleProjectId(e.target.value)}
              className="h-11"
            />
          </Field>
          <Field
            label="Project Description"
            htmlFor="oracle-project-description"
            badge={<AutoBadge label="From Oracle" />}
          >
            <Input
              id="oracle-project-description"
              placeholder="Fetched automatically once synced"
              disabled
              className="h-11"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <Button
            onClick={addMapping}
            className="h-11 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            Add Oracle Project
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
