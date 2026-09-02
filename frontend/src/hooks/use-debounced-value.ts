import * as React from "react";

// Returns `value` delayed by `delayMs`, resetting the timer on every change —
// so a fast-typing user only triggers downstream work (e.g. a search request)
// once they pause. No debounce hook existed in the codebase before this.
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
