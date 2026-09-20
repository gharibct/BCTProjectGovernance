"use client";

import * as React from "react";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonSpinner, SectionCard } from "@/components/forms/form-primitives";
import { EntryFields, useEntryValues, type FieldDef } from "@/components/forms/entry-form";
import { RegisterTable } from "@/components/forms/register-table";
import { usePageBanner } from "@/stores/page-banner";
import {
  PROJECT_CURRENCIES,
  useDeleteExchangeRate,
  useExchangeRates,
  useSaveExchangeRate,
  type ExchangeRate,
} from "@/lib/api/exchange-rates";

const fields: FieldDef[] = [
  {
    key: "currency",
    label: "Project Currency",
    kind: "select",
    mandatory: true,
    options: PROJECT_CURRENCIES.filter((c) => c !== "USD"),
  },
  { key: "rate_to_usd", label: "Rate to USD (1 unit = ? USD)", kind: "number", mandatory: true },
];

export function ExchangeRatesPanel() {
  const { data: rates = [] } = useExchangeRates();
  const { values, set, reset, load } = useEntryValues();
  const [editing, setEditing] = React.useState(false);
  const saveRate = useSaveExchangeRate();
  const deleteRate = useDeleteExchangeRate();
  const showSuccess = usePageBanner((state) => state.showSuccess);
  const showError = usePageBanner((state) => state.showError);

  const startEdit = (rate: ExchangeRate) => {
    setEditing(true);
    load({ currency: rate.currency, rate_to_usd: rate.rate_to_usd });
  };

  const cancelEdit = () => {
    setEditing(false);
    reset();
  };

  const handleDelete = (rate: ExchangeRate) => {
    deleteRate.mutate(rate.id, {
      onSuccess: () => {
        if (editing && values.currency === rate.currency) cancelEdit();
        showSuccess("Exchange Rate Deleted Successfully");
      },
      onError: (err) => showError(err instanceof Error ? err.message : "Failed to delete exchange rate."),
    });
  };

  async function submit() {
    const rate = Number(values.rate_to_usd);
    if (!values.currency || !values.rate_to_usd || !(rate > 0)) {
      showError("Select a currency and enter a rate greater than 0.");
      return;
    }
    try {
      await saveRate.mutateAsync({ currency: values.currency, rate_to_usd: values.rate_to_usd });
      cancelEdit();
      showSuccess("Exchange Rate Saved Successfully");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to save exchange rate.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <SectionCard icon={Coins} title="Exchange Rates">
        <RegisterTable
          items={rates}
          emptyLabel="No exchange rates yet. Projects in a non-USD currency show no Revenue in USD until a rate is added."
          onEdit={startEdit}
          onDelete={handleDelete}
          columns={[
            { key: "currency", label: "Project Currency" },
            { key: "rate_to_usd", label: "Rate to USD" },
            {
              key: "updated_at",
              label: "Last Updated",
              render: (item) => new Date(item.updated_at).toLocaleDateString(),
            },
          ]}
        />
      </SectionCard>

      <SectionCard icon={Coins} title={editing ? "Edit Exchange Rate" : "Add / Update Exchange Rate"}>
        <EntryFields defs={fields} values={values} set={set} />
        <p className="mt-3 text-xs text-slate-500">
          Saving a rate re-converts Revenue in USD for every project in that currency. Saving an existing currency
          replaces its rate.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          {editing ? (
            <Button variant="outline" className="h-11 px-6 text-sm font-semibold" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
          <Button
            onClick={submit}
            disabled={saveRate.isPending}
            className="h-11 gap-2 bg-[#1a4a7a] px-6 text-sm font-semibold text-white hover:bg-[#15406b]"
          >
            {saveRate.isPending ? <ButtonSpinner /> : null}
            Save Rate
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
