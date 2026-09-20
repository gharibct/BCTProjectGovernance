import type { Metadata } from "next";

import { ExchangeRatesPanel } from "@/components/admin/exchange-rates-panel";

export const metadata: Metadata = {
  title: "Exchange Rates | Governance One",
};

export default function AdminExchangeRatesPage() {
  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <header className="border-b border-slate-200 pb-5">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Exchange Rates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rate from each project currency to USD (USD per 1 unit). Used to convert Project Revenue to Revenue in USD.
        </p>
      </header>
      <ExchangeRatesPanel />
    </div>
  );
}
