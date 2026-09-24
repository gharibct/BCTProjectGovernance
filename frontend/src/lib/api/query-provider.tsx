"use client";

import * as React from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";

// Defense-in-depth for a 403 on a *secondary* query on an otherwise-loaded
// page (a page's primary scoped query is expected to render its own
// <QueryErrorState/> instead — see reporting-hub.tsx / regional-reporting-
// hub.tsx). This only covers what those don't: some other query on the same
// page hitting an ownership check it doesn't pass.
function handleQueryError(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    toast.error("You don't have access to some of this page's data.");
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({ onError: handleQueryError }),
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
