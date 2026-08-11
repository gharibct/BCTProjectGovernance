"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { usePageBanner } from "@/stores/page-banner";

// Clears the active page banner whenever the route changes, so a message
// shown on one screen doesn't linger after the user navigates to an
// unrelated one. Skips the very first render (mount) so a banner set with
// `persistThroughNavigation: true` right before a redirect (e.g. Project
// Creation) survives landing on the destination page.
export function PageBannerNavigationListener() {
  const pathname = usePathname();
  const consumeNavigationPersist = usePageBanner((state) => state.consumeNavigationPersist);
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    consumeNavigationPersist();
  }, [pathname, consumeNavigationPersist]);

  return null;
}
